/**
 *
 *      ioBroker Fronius inverters Adapter
 *
 *      (c) 2017 ldittmar <iobroker@lmdsoft.de>
 *
 *      MIT License
 *
 */

/* global __dirname */
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
const utils = require("@iobroker/adapter-core");
//const utils = require(__dirname + '/lib/utils'); // Get common adapter utils

const request = require('request');
const ping = require(__dirname + '/lib/ping');

let ip, baseurl, apiver, requestType;
let isConnected = null;


const units=["",
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

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'taconnect',
        undload: function (callback) {
            // is called when adapter shuts down - callback has to be called under any circumstances!
            try {
                adapter.log.info('cleaned everything up...');
                callback();
            } catch (e) {
                callback();
            }
        },
        objectChange: function (id, obj) {
            // is called if a subscribed object changes
            adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
        },
        stateChange: function (id, state) {
            // is called if a subscribed state changes
            // Warning, state can be null if it was deleted
            adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

            // you can use the ack flag to detect if it is status (true) or command (false)
            if (state && !state.ack) {
                adapter.log.info('ack is not set!');
            }
        },
        // message: function (obj) {
        //     // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
        //     let wait = false;
        //     if (obj) {
        //         switch (obj.command) {
        //             case 'checkIP':
        //                 checkIP(obj.message, function (res) {
        //                     if (obj.callback)
        //                         adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
        //                 });
        //                 wait = true;
        //                 break;
        //             case 'getDeviceInfo':
        //                 getActiveDeviceInfo("System", obj.message, function (res) {
        //                     if (obj.callback)
        //                         adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
        //                 });
        //                 wait = true;
        //                 break;
        //             case 'getDeviceInfoInverter':
        //                 getActiveDeviceInfo("Inverter", obj.message, function (res) {
        //                     if (obj.callback)
        //                         adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
        //                 });
        //                 wait = true;
        //                 break;
        //             case 'getDeviceInfoSensor':
        //                 getActiveDeviceInfo("SensorCard", obj.message, function (res) {
        //                     if (obj.callback)
        //                         adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
        //                 });
        //                 wait = true;
        //                 break;
        //             case 'getDeviceInfoString':
        //                 getActiveDeviceInfo("StringControl", obj.message, function (res) {
        //                     if (obj.callback)
        //                         adapter.sendTo(obj.from, obj.command, JSON.stringify(res), obj.callback);
        //                 });
        //                 wait = true;
        //                 break;
        //             default:
        //                 adapter.log.warn("Unknown command: " + obj.command);
        //                 break;
        //         }
        //     }
        //     if (!wait && obj.callback) {
        //         adapter.sendTo(obj.from, obj.command, obj.message, obj.callback);
        //     }
        //     return true;
        // },
        ready: main
    });
    adapter = new utils.Adapter(options);

    return adapter;
}

function checkStatus(nodes){
	if (!nodes) nodes= getNodes();

	for (var i=0; i<nodes.length;i++){
		if (nodes[i]) {
			updateStates(nodes[i], "Inputs");
			updateStates(nodes[i], "Outputs");
			updateStates(nodes[i], "DL-Bus");
		}
	}
	if (nodes.length) adapter.log.info("Updated TA nodes.");
}

function updateStates(node, name){
	if (!node) return
	if (node.content["Status code"]==4) {
		//TOO MANY REQUESTS -> wait 30 sec
		adapter.log.info(node.content.Status);
		sleep(30);
	}
	if (node.content.Data[name].length>0){
		for (var i=0;i<node.content.Data.Inputs.length;i++){
			var obj=node.content.Data[name][i];
			adapter.setState(node.canid+"."+name+"."+obj.Number, {val: obj.Value.Value, ack: true} );
		}
		adapter.log.debug("Updating "+name+" Objects.");
	}
}

async function getNodes() {
	const util = require('util');
	const exec = util.promisify(require('child_process').exec);
	const command = "python3 python/main.py "+adapter.config.cmi_username+" "+adapter.config.cmi_password+" "+adapter.config.ipadress;
	
	const {error, stdout, stderr } = await exec(command);
	if (error) {
		adapter.log.error(`error: ${error.message}`);
		return;
	}
	if (stderr) {
		adapter.log.eror(`stderr: ${stderr}`);
		return;
	}
	//adapter.log.debug(`response: ${stdout}`);
	try{
		return JSON.parse(stdout);
	} 
	catch(SyntaxError){
		adapter.log.error("Couldn't read Json");
		return [];
	}
}

function createObjects(){
	var nodes=getNodes();
	adapter.log.debug("Creating Objects.");
	for (var i=0; i<nodes.length;i++){
		if (nodes[i]) writeObjects(nodes[i]);
	}
	checkStatus(nodes)
}

function writeObjects(node) {
	if (node.content["Status code"]==4) {
		//TOO MANY REQUESTS -> wait 30 sec
		adapter.log.info(node.content.Status);
		sleep(30);
		return;
	}

	//Controller ertellen
	adapter.setObjectNotExists(node.canid, {
		type: "device",
		common: {
			name: node.name,
			read: true,
			write: false,
		},
		native: {},
	});	
	
	//Can ID 
	adapter.setObjectNotExists(node.canid+".CanID", {
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
	adapter.setStat(node.canid+".CanID", node.canid);

	//Controller Type
	adapter.setObjectNotExists(node.canid+".Typ", {
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
	adapter.setState(node.canid+".Typ", node.type);

	var arr=node.content;
	if (!arr) return;

	// Inputs		
	if (arr.Data.Inputs.length>0){
		for (var i=0;i<arr.Data.Inputs.length;i++){
			var obj=arr.Data.Inputs[i];
			var name=node.canid+".Inputs."+obj.Number;
			adapter.setObjectNotExists(name, {
				type: "state",
				common: {
					name: "S"+obj.Number,
					type: (obj.AD==0 ? "number":"boolean"),
					role: (obj.AD==0 ? "value":"switch"),
					read: true,
					write: false,
					unit: units[obj.Value.Unit]
				},
				native: {},
			});	
		}
		adapter.log.info("Adding "+arr.Data.Inputs.length+" inputs!");
	}
	else adapter.log.info("no inputs received!");

	// Outputs		
	if (arr.Data.Outputs.length>0){
		for (var i=0;i<arr.Data.Outputs.length;i++){
			var obj=arr.Data.Outputs[i];
			var name=node.canid+".Outputs."+obj.Number;
			adapter.setObjectNotExists(name, {
				type: "state",
				common: {
					name: "A"+obj.Number,
					type: (obj.AD==0 ? "number":"boolean"),
					role: "value",
					read: true,
					write: false,
					unit: units[obj.Value.Unit]
				},
				native: {},
			});	
		}
		adapter.log.info("Adding "+arr.Data.Outputs.length+" outputs!");
	}
	else adapter.log.info("no outputs received!");


	// DL-Bus		
	if (arr.Data["DL-Bus"].length>0){
		for (var i=0;i<arr.Data["DL-Bus"].length;i++){
			var obj=arr.Data["DL-Bus"][i];
			if (!obj) continue;
			var name=node.canid+".DL-Bus."+obj.Number;
			adapter.setObjectNotExists(name, {
				type: "state",
				common: {
					name: "DL"+obj.Number,
					type: (obj.AD=="A" ? "number":"boolean"),
					role: "value",
					read: true,
					write: false,
					unit: units[obj.Value.Unit]
				},
				native: {},
			});	
		}
		adapter.log.info("Adding "+arr.Data["DL-Bus"].length+" DL-Bus!");
	}
	else adapter.log.info("no DL-Bus received!");
}

function main() {

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:

    var ip = adapter.config.ipadress;
	var username=adapter.config.cmi_username;
	var password=adapter.config.cmi_password;

    if (ip && username && password) {

        createObjects();

        let secs = adapter.config.cmi_poll;
        if (isNaN(secs) || secs < 1) {
            secs = 30;
        }

        setInterval(checkStatus, secs * 1000);

    } else {
        adapter.log.error("Please configure the Taconnect adapter");
    }


}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 