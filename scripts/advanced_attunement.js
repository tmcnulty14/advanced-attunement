/**
 * The main module class. Contains constants and static helper methods.
 **/
class AdvancedAttunement {
    static ID = 'advanced-attunement';

    static FLAGS = {
        // An item's attunement weight.
        ATTUNEMENT_WEIGHT: 'attunement-weight',

        // An actor's attunement burden (sum of their attuned items' weights).
        ATTUNEMENT_BURDEN: 'attunement-burden'
    }

    /**
     * Log helper.
     **/
    static log(...args) {  
        console.log(this.ID, '|', ...args);
    }

    /**
     * Log helper.
     **/
    static debug(...args) {  
        const shouldLog = game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

        if (shouldLog) {
            console.log(this.ID, '|', ...args);
        }
    }

    /**
     * Warning log helper.
     **/
    static warn(...args) {
        console.warn(this.ID, '|', ...args);
    }

    /**
     * Error log helper.
     **/
    static error(...args) {
        console.error(this.ID, '|', ...args);
    }

    static initialize() {
        // Nothing to do right now.
        // Might be used for registering settings later.
    }

    /**
     * Gets all player character actors in the game.
     **/
    static get playerCharacters() {
        return game.actors.filter(this.isPlayerCharacter);
    }

    /**
     * Checks if an actor is a player character.
     **/
    static isPlayerCharacter(actor) {
        return actor.type === 'character';
    }

    /**
     * Checks if an item is attunable.
     **/
    static isAttunable(item) {
        return item.system.attunement === 1 || this.isAttuned(item);
    }

    /**
     * Checks if an item is currently attuned.
     **/
    static isAttuned(item) {
        return item.system.attunement === 2;
    }
}

/**
 * Initialization hook. May be used in the future.
 **/
Hooks.once('init', () => {
    AdvancedAttunement.initialize();
});


/**
 * Register this module with Developer Mode for debug logging.
 **/
Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
    registerPackageDebugFlag(AdvancedAttunement.ID);
});


/**
 * Dev debug hook: Log all attuned items' weights on ready.
 **/
Hooks.once('ready', () => {
    for (const actor of AdvancedAttunement.playerCharacters) {
        const attunedItems = [...actor.items.values()].filter(AdvancedAttunement.isAttuned);

        AdvancedAttunement.debug(`${actor.name} (${actor.id})`, attunedItems.map(item => 
            `${item.name} (${item.id}): ${item.getFlag(AdvancedAttunement.ID, AdvancedAttunement.FLAGS.ATTUNEMENT_WEIGHT)}`));


        // TODO: Set 
    }
});


/**
 * Use the updateItem hook to update a player character's attunement burden when one of their
 * attunable items is updated.
 **/
Hooks.on('updateItem', (item) => { // Args?
    // If the item is an attunable item held by a player character, update that PC's attunement burden. 
    if (AdvancedAttunement.isAttunable(item) && AdvancedAttunement.isPlayerCharacter(item.parent)) {
        const actorData = new AdvancedAttunementActorData(item.parent);
        actorData.updateAttunementBurden();
    }
});


/**
 * Use Tidy5e's sheet rendering hook to display advanced attunement weight & burden in the Inventory.
 **/
Hooks.on('renderTidy5eSheet', (app, html, data) => {
    const actor = app.object;
    const actorData = new AdvancedAttunementActorData(actor);

    // Show attunement weight next to attunement icon in inventory tab.
    const attunableItemIconsQuery = html.find('div.item-detail').filter('.attunement');
    attunableItemIconsQuery.each((index, iconDiv) => {
        const itemId = iconDiv.parentElement.getAttribute('data-item-id');
        const itemData = actorData.getItem(itemId);
        if (itemData) {
            const itemAttunementWeight = itemData.getAttunementWeight();
            if (itemAttunementWeight) {
                iconDiv.insertAdjacentHTML('afterbegin',
                    `\n<div class="item-detail item-attunement-weight">${itemAttunementWeight}</div>`);
            }
        } else {
            AdvancedAttunement.warn(`Could not load item ${itemId} from parent actor.`, actor);            
        }
    });


    // Show attunement burden instead of attunement count.
    const actorAttunementBurden = actorData.getAttunementBurden();

    const attunementDisplayQuery = html.find('[class="attuned-items-current"]');
    attunementDisplayQuery.each((index, attunementDisplay) => {
        AdvancedAttunement.log(`Displaying attunement burden (${actorAttunementBurden}) on ${actor.name}'s Tidy5eSheet.`);
        attunementDisplay.replaceChildren(`${actorAttunementBurden}`);
    });

    // TODO: Override Tidy5e's attunement validity check and warning to use weight/burden.
});

/**
 * Use DnD5e's item sheet rendering hook to display an editable attunement weight field in the item
 * sheet's details tab.
 **/
Hooks.on('renderItemSheet5e', (app, html, data) => { // Args?
    // Add an editable form field in the Item Sheet's details tab for editing item attunement weight.
    const item = app.object;
    const itemData = new AdvancedAttunementItemData(item);
    const attunementWeight = itemData.getAttunementWeight();

    const attunementGroupQuery = html.find(':has([name="system.attunement"])').last();
    const label = `<label>${game.i18n.localize('ADV-ATTUNE.attunement-weight')}</label>`;
    const field = `<input type="number" min="0" step="1"`
            + `name="flags.${AdvancedAttunement.ID}.${AdvancedAttunement.FLAGS.ATTUNEMENT_WEIGHT}"`
            + ` value="${attunementWeight}" placeholder="1">`;
    attunementGroupQuery.after(`\n<div class="form-group">${label}${field}</div>`);
})




// Data classes

/**
 * The AdvancedAttunement data class for Actor data. Wraps a Foundry Actor document.
 **/
class AdvancedAttunementActorData {
    constructor(actor) {
        this._actor = actor;
    }

    /**
     * Gets this actor's attunement burden.
     **/
    getAttunementBurden() {
        return this._actor.getFlag(AdvancedAttunement.ID, AdvancedAttunement.FLAGS.ATTUNEMENT_BURDEN);
    }

     /**
     * Sets this actor's attunement burden.
     **/
    setAttunementBurden(burden) {
        const sanitizedBurden = Math.max(0, Math.floor(burden));

        return this._actor.setFlag(AdvancedAttunement.ID, AdvancedAttunement.FLAGS.ATTUNEMENT_BURDEN,
                sanitizedBurden);
    }

     /**
     * Updates this actor's attunement burden based on the total attunement weights of its attuned items.
     **/
    updateAttunementBurden() {
        const currentBurden = this.getAttunementBurden();
        const newBurden = this._actor.items.filter(AdvancedAttunement.isAttuned)
                                  .map(item => new AdvancedAttunementItemData(item))
                                  .map(itemData => itemData.getAttunementWeight())
                                  .reduce((a, b) => a + b, 0);
        if (newBurden !== currentBurden) {
            AdvancedAttunement.log(`Updating attunement burden of ${this._actor.name}: ${currentBurden} -> ${newBurden}`);
            return this.setAttunementBurden(newBurden);
        }
    }

    /**
     * Gets the AdvancedAttunement actor data for the given player character actor id.
     **/
    static getActor(actorId) {
        const actor = game.actors.get(actorId);

        if (actor && AdvancedAttunement.isPlayerCharacter(actor)) {
            return new AdvancedAttunementActorData(actor);
        } else {
            return undefined;
        }
    }

    /**
     * Gets the AdvancedAttunement item data for the given item id owned by this actor.
     **/
    getItem(itemId) {
        const item = this._actor.items.get(itemId);

        if (item && AdvancedAttunement.isAttunable(item)) {
            return new AdvancedAttunementItemData(item);
        } else {
            return null;
        }
    }
}


/**
 * The AdvancedAttunement data class for Item data. Wraps a Foundry Item document.
 **/
class AdvancedAttunementItemData {
    static DEFAULT_WEIGHT = 1;

    constructor(item) {
        this._item = item;
    }

    /**
     * Gets this item's current attunement weight.
     * Defaults to AdvancedAttunementItemData.DEFAULT_WEIGHT.
     **/
    getAttunementWeight() {
        const weight = this._item.getFlag(AdvancedAttunement.ID, AdvancedAttunement.FLAGS.ATTUNEMENT_WEIGHT);

        return AdvancedAttunementItemData.sanitizeWeight(weight);
    }

    /**
     * Sets this item's attunement weight. (NOT USED RIGHT NOW)
     **/
    setAttunementWeight(weight) {
        const sanitizedWeight = AdvancedAttunementItemData.sanitizeWeight(weight);

        return this._item.setFlag(AdvancedAttunement.ID, AdvancedAttunement.FLAGS.ATTUNEMENT_WEIGHT,
                sanitizedWeight);
    }

    /**
     * Sanitizes a weight value.
     **/
    static sanitizeWeight(weight) {
        return weight === undefined
                ? AdvancedAttunementItemData.DEFAULT_WEIGHT
                : Math.max(0, Math.floor(weight));
    }
}
