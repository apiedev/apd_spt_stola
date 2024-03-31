import { DependencyContainer } from "tsyringe";

// SPT types
import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { PreAkiModLoader } from "@spt-aki/loaders/PreAkiModLoader";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { ImageRouter } from "@spt-aki/routers/ImageRouter";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { ITraderAssort, ITraderBase } from "@spt-aki/models/eft/common/tables/ITrader";
import { ITraderConfig, UpdateTime } from "@spt-aki/models/spt/config/ITraderConfig";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { IDatabaseTables } from "@spt-aki/models/spt/server/IDatabaseTables";
import { IRagfairConfig } from "@spt-aki/models/spt/config/IRagfairConfig";


// New trader settings RopesShop
import * as baseJson from "../db/base.json";
import { Traders } from "@spt-aki/models/enums/Traders";
import * as assortJson from "../db/assort.json";

class SariaShop implements IPreAkiLoadMod, IPostDBLoadMod {
    mod: string
    logger: ILogger
    private configServer: ConfigServer;
    private ragfairConfig: IRagfairConfig; 

    constructor() {
        this.mod = "Ms.Stola"; // Set name of mod so we can log it to console later
    }

    /**
     * Some work needs to be done prior to SPT code being loaded, registering the profile image + setting trader update time inside the trader config json
     * @param container Dependency container
     */
    public preAkiLoad(container: DependencyContainer): void {
        this.logger = container.resolve<ILogger>("WinstonLogger");
        this.logger.debug(`[${this.mod}] preAki Loading... `);

        const preAkiModLoader: PreAkiModLoader = container.resolve<PreAkiModLoader>("PreAkiModLoader");
        const imageRouter: ImageRouter = container.resolve<ImageRouter>("ImageRouter");
        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const traderConfig: ITraderConfig = configServer.getConfig<ITraderConfig>(ConfigTypes.TRADER);
        
        this.registerProfileImage(preAkiModLoader, imageRouter);
        
        this.setupTraderUpdateTime(traderConfig);
        
        // Add trader to trader enum
        Traders["Ms.Stola"] = "Ms.Stola";
        this.logger.debug(`[${this.mod}] preAki Loaded`);
    }
    
    /**
     * Majority of trader-related work occurs after the aki database has been loaded but prior to SPT code being run
     * @param container Dependency container
     */
    public postDBLoad(container: DependencyContainer): void {
        this.logger.debug(`[${this.mod}] postDb Loading... `);

        this.configServer = container.resolve("ConfigServer");
        this.ragfairConfig = this.configServer.getConfig(ConfigTypes.RAGFAIR);
		
		const logger = container.resolve("WinstonLogger");
		this.logger.log("Stola's going out to get medical supplies!", "blue");

        // Resolve SPT classes we'll use
        const databaseServer: DatabaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const configServer: ConfigServer = container.resolve<ConfigServer>("ConfigServer");
        const traderConfig: ITraderConfig = configServer.getConfig(ConfigTypes.TRADER);
        const jsonUtil: JsonUtil = container.resolve<JsonUtil>("JsonUtil");

        // Get a reference to the database tables
        const tables = databaseServer.getTables();

        // Add new trader to the trader dictionary in DatabaseServer
        this.addTraderToDb(baseJson, tables, jsonUtil);

        this.addTraderToLocales(tables, baseJson.name, "Stola", baseJson.nickname, baseJson.location, "Retired military nurse. Neutral between both sides, She has a large supply of medical items.");

        // Add item purchase threshold value (what % durability does trader stop buying items at)
//        traderConfig.durabilityPurchaseThreshhold[baseJson._id] = 60;
        this.ragfairConfig.traders[baseJson._id] = true;

        this.logger.debug(`[${this.mod}] postDb Loaded`);
		this.logger.log("Stola's heading back to base.", "blue");
    }

    /**
     * Add profile picture to our trader
     * @param preAkiModLoader mod loader class - used to get the mods file path
     * @param imageRouter image router class - used to register the trader image path so we see their image on trader page
     */
    private registerProfileImage(preAkiModLoader: PreAkiModLoader, imageRouter: ImageRouter): void
    {
        // Reference the mod "res" folder
        const imageFilepath = `./${preAkiModLoader.getModPath(this.mod)}res`;

        // Register a route to point to the profile picture
        imageRouter.addRoute(baseJson.avatar.replace(".jpg", ""), `${imageFilepath}/Stola.jpg`);
    }

    /**
     * Add record to trader config to set the refresh time of trader in seconds (default is 60 minutes)
     * @param traderConfig trader config to add our trader to
     */
    private setupTraderUpdateTime(traderConfig: ITraderConfig): void {
        const traderRefreshRecord: UpdateTime = { seconds: {min:3600,max:4200}, traderId: baseJson._id }
        traderConfig.updateTime.push(traderRefreshRecord)
    }

    /**
     * Add our new trader to the database
     * @param traderDetailsToAdd trader details
     * @param tables database
     * @param jsonUtil json utility class
     */
    
// rome-ignore lint/suspicious/noExplicitAny: traderDetailsToAdd comes from base.json, so no type
private  addTraderToDb(traderDetailsToAdd: any, tables: IDatabaseTables, jsonUtil: JsonUtil): void
    {
        // Add trader to trader table, key is the traders id
        tables.traders[traderDetailsToAdd._id] = {
            assort: jsonUtil.deserialize(jsonUtil.serialize(assortJson)) as ITraderAssort, // assorts are the 'offers' trader sells, can be a single item (e.g. carton of milk) or multiple items as a collection (e.g. a gun)
            base: jsonUtil.deserialize(jsonUtil.serialize(traderDetailsToAdd)) as ITraderBase,
            questassort: {
                started: {},
                success: {},
                fail: {}
            } // Empty object as trader has no assorts unlocked by quests
        };
    }

    /**
     * Add traders name/location/description to the locale table
     * @param tables database tables
     * @param fullName fullname of trader
     * @param firstName first name of trader
     * @param nickName nickname of trader
     * @param location location of trader
     * @param description description of trader
     */
    private addTraderToLocales(tables: IDatabaseTables, fullName: string, firstName: string, nickName: string, location: string, description: string)
    {
        // For each language, add locale for the new trader
        const locales = Object.values(tables.locales.global) as Record<string, string>[];
        for (const locale of locales) {
            locale[`${baseJson._id} FullName`] = fullName;
            locale[`${baseJson._id} FirstName`] = firstName;
            locale[`${baseJson._id} Nickname`] = nickName;
            locale[`${baseJson._id} Location`] = location;
            locale[`${baseJson._id} Description`] = description;
        }
    }

    private addItemToLocales(tables: IDatabaseTables, itemTpl: string, name: string, shortName: string, Description: string)
    {
        // For each language, add locale for the new trader
        const locales = Object.values(tables.locales.global) as Record<string, string>[];
        for (const locale of locales) {
            locale[`${itemTpl} Name`] = name;
            locale[`${itemTpl} ShortName`] = shortName;
            locale[`${itemTpl} Description`] = Description;
        }
    }
}   
    
module.exports = { mod: new SariaShop() }   
