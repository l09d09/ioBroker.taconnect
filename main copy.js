"use strict";

/*
 * Created with @iobroker/create-adapter v1.32.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
//const bent = require("bent");
//const fetch = require('node-fetch');
//const { exec } = require("child_process");
// Load your modules here, e.g.:
// const fs = require("fs");

class Taconnect extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "taconnect",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
		this.loop=true;

		this.units=["",
			"°C",
			"W/m²", 
			"l/h", 
			"sek",
			"min",
			"l/Imp",
			"K",
			"%",
			"kW",
			"kWh",
			"MWh",
			"V",
			"mA",
			"Std",
			"Tage",
			"Imp",
			"kΩ",
			"l",
			"km/h",
			"Hz",
			"l/min",
			"bar",
			"",
			"km",
			"m",
			"mm",
			"m³",
			"l/d",
			"m/s",
			"m³/min",
			"m³/h",
			"m³/d",
			"mm/min",
			"mm/h",
			"mm/d",
			"Aus/EIN",
			"NEIN/JA",
			"°C",
			"€",
			"$"
		];

	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		// await this.setObjectNotExistsAsync("testVariable", {
		// 	type: "state",
		// 	common: {
		// 		name: "testVariable",
		// 		type: "boolean",
		// 		role: "indicator",
		// 		read: true,
		// 		write: true,
		// 	},
		// 	native: {},
		// });

		// // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		// this.subscribeStates("testVariable");
		// // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// // this.subscribeStates("lights.*");
		// // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// // this.subscribeStates("*");

		// /*
		// 	setState examples
		// 	you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		// */
		// // the variable testVariable is set to true as command (ack=false)
		// await this.setStateAsync("testVariable", true);

		// // same thing, but the value is flagged "ack"
		// // ack should be always set to true if the value is received from or acknowledged from the target system
		// await this.setStateAsync("testVariable", { val: true, ack: true });

		// // same thing, but the state is deleted after 30s (getState will return null afterwards)
		// await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// // examples for the checkPassword/checkGroup functions
		// let result = await this.checkPasswordAsync("admin", "iobroker");
		// this.log.info("check user admin pw iobroker: " + result);

		// result = await this.checkGroupAsync("admin", "admin");
		// this.log.info("check group user admin group admin: " + result);
        //this.log.debug("got response:"+ data);
		var nodes=await this.getNodes();

		for (var i=0; i<nodes.length;i++){
			if (nodes[i]) await this.writeObjects(nodes[i]);
		}

		while (this.loop){
			this.log.debug("loop started");
			await this.sleep(30);
			await this.checkStatus();
		}	
	}

	async sleep(seconds){
		const date = Date.now();
		let currentDate = null;
		do {
			currentDate = Date.now();
		} while (currentDate - date < seconds*1000);
	}

	async getNodes() {
		const util = require('util');
		const exec = util.promisify(require('child_process').exec);
		
		const {error, stdout, stderr } = await exec("python3 python/main.py "+this.config.cmi_username+" "+this.config.cmi_password+" "+this.config.ipadress);
		if (error) {
			this.log.error(`error: ${error.message}`);
			return;
		}
		if (stderr) {
			this.log.eror(`stderr: ${stderr}`);
			return;
		}
		this.log.debug(`${stdout}`);
		return JSON.parse(stdout);
	}

	async checkStatus(){
		var nodes= await this.getNodes();
		this.log.info("Updated TA nodes.");

		for (var i=0; i<nodes.length;i++){
			if (nodes[i]) {
				await this.updateStates(nodes[i], "Inputs");
				await this.updateStates(nodes[i], "Outputs");
				await this.updateStates(nodes[i], "DL-Bus");
			}
		}
	}

	async updateStates(node, name){
		if (node.content["Status code"]==4) {
			this.log.info(node.content.Status);
			await this.sleep(30);
			return;
		}
		if (node.content.Data.Inputs.length>0){
			for (var i=0;i<node.content.Data.Inputs.length;i++){
				var obj=node.content.Data[name][i];
				await this.setStateAsync(node.canid+"."+name+"."+obj.Number, obj.Value.Value);
			}
		}
	}

	async writeObjects(node) {
		if (node.content["Status code"]==4) {
			this.log.info(node.content.Status);
			await this.sleep(30);
			return;
		}

		//Controller ertellen
		await this.setObjectNotExistsAsync(node.canid, {
			type: "device",
			common: {
				name: node.name,
				read: true,
				write: false,
			},
			native: {},
		});	
		
		//Can ID 
		await this.setObjectNotExistsAsync(node.canid+".CanID", {
			type: "state",
			common: {
				name: "CanID",
				type: "number",
				role: "info.adress",
				read: true,
				write: false,
			},
			native: {},
		});	
		await this.setStateAsync(node.canid+".CanID", node.canid);

		//Controller Type
		await this.setObjectNotExistsAsync(node.canid+".Typ", {
			type: "state",
			common: {
				name: "Typ",
				type: "string",
				role: "value",
				read: true,
				write: false,
			},
			native: {},
		});	
		await this.setStateAsync(node.canid+".Typ", node.type);

		var arr=node.content;
		if (!arr) return;

		// Inputs		
		if (arr.Data.Inputs.length>0){
			for (var i=0;i<arr.Data.Inputs.length;i++){
				var obj=arr.Data.Inputs[i];
				var name=node.canid+".Inputs."+obj.Number;
				await this.setObjectNotExistsAsync(name, {
					type: "state",
					common: {
						name: "S"+obj.Number,
						type: (obj.AD==0 ? "number":"boolean"),
						role: (obj.AD==0 ? "value":"switch"),
						read: true,
						write: false,
						unit: this.units[obj.Value.Unit]
					},
					native: {},
				});	
				await this.setStateAsync(name, obj.Value.Value);
			}
			this.log.info("Adding "+arr.Data.Inputs.length+" inputs!");
		}
		else this.log.info("no inputs received!");

		// Outputs		
		if (arr.Data.Outputs.length>0){
			for (var i=0;i<arr.Data.Outputs.length;i++){
				var obj=arr.Data.Outputs[i];
				var name=node.canid+".Outputs."+obj.Number;
				await this.setObjectNotExistsAsync(name, {
					type: "state",
					common: {
						name: "A"+obj.Number,
						type: (obj.AD==0 ? "number":"boolean"),
						role: "value",
						read: true,
						write: false,
						unit: this.units[obj.Value.Unit]
					},
					native: {},
				});	
				await this.setStateAsync(name, obj.Value.Value);
			}
			this.log.info("Adding "+arr.Data.Outputs.length+" outputs!");
		}
		else this.log.info("no outputs received!");


		// DL-Bus		
		if (arr.Data["DL-Bus"].length>0){
			for (var i=0;i<arr.Data["DL-Bus"].length;i++){
				var obj=arr.Data["DL-Bus"][i];
				if (!obj) continue;
				var name=node.canid+".DL-Bus."+obj.Number;
				await this.setObjectNotExistsAsync(name, {
					type: "state",
					common: {
						name: "DL"+obj.Number,
						type: (obj.AD=="A" ? "number":"boolean"),
						role: "value",
						read: true,
						write: false,
						unit: this.units[obj.Value.Unit]
					},
					native: {},
				});	
				await this.setStateAsync(name, obj.Value.Value);
			}
			this.log.info("Adding "+arr.Data["DL-Bus"].length+" DL-Bus!");
		}
		else this.log.info("no DL-Bus received!");
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			this.loop=false;
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Taconnect(options);
} else {
	// otherwise start the instance directly
	new Taconnect();
}