'use strict';
const _ = require('lodash');
const Vorpal = require('vorpal');
const CLEAR_CODE = '\u001b[2J\u001b[0;0H';

let self = undefined;

class LarryCli{
	constructor(registry={}, options = {prompt:'larry>'}){
		self = this; // eslint-disable-line
		this._cliModuleRegistry = registry;
		this._vorpalInstance = new Vorpal();
		this._vorpalInstance.use(this._commonActions);
		this._subModulesRegistry={};
		this._prompt = _.get(options, 'prompt', 'larry>');

		this._init();
	}
	_commonActions(vorpalInstance) {
		//Enter sub cli
		vorpalInstance
			.command('enter [subCli]')
			.description('Enter a sub cli.')
			.action(function (command) {
				let prom = Promise.resolve(command.subCli);
	
				//if the user didnt pick a sub cli
				if (!command.subCli) {
					vorpalInstance.log(vorpalInstance.chalk.green('ctrl-c to cancel this action.'));
					prom = this.prompt([
						{
							type: 'list',
							name: 'subCli',
							message: 'Here are the availble sub clis:',
							choices: Object.keys(self._subModulesRegistry)
						}
					]).then((answers) => {
						return answers.subCli;
					});
				}
				return prom.then((subCli) => {
					self._subModulesRegistry[subCli].show();
				});
			});
	
		//Catch all other commands
		vorpalInstance
			.catch('[input...]')
			.action(function (command, cb) {
				//If the command is the name of a mode jump to that mode
				if (_.isArray(command.input)) {
					switch (command.input[0]) {
					case 'clear':
						vorpalInstance.log(CLEAR_CODE);
						cb();
						break;
					case '?':
						vorpalInstance.execSync('help');
						cb();
						break;
					default:
						if (command.input.length === 1 && self._subModulesRegistry[command.input[0]]) {
							self._subModulesRegistry[command.input[0]].show();
						}
						cb();
					}
				}
				else {
					cb();
				}
			});
		
		//pwd
		vorpalInstance
			.command('pwd', 'What directory am I in?')
			.action((args, callback)=>{
				vorpalInstance.log(process.cwd());
				callback();
			});
	}
	_subModuleCommonActions(vorpalInstance) {
		//home
		vorpalInstance
			.command('home')
			.description('Return to the root menu.')
			.action(function (command, callback) {
				vorpalInstance.show();
				callback();
			});
	}
	_init(){
		this._initErrorHandlers();
		this._loadSubModules();
	}
	_initErrorHandlers(){
		process.on('unhandledRejection', (reason, p) => {
			this._vorpalInstance.log('Unhandled Rejection at:', p, 'reason:', reason);
			process.exit(-1);
		});
		process.on('uncaughtException', (err) => {
			this._vorpalInstance.log('Uncaught Exception:', err);
			process.exit(-1);
		});
	}
	_loadSubModules(){
		this._subModulesRegistry={};
		Object.keys(this._cliModuleRegistry).forEach(cliName => {
			let cliModuleClass = this._cliModuleRegistry[cliName];
			let cliVorpalInstance = new Vorpal();
			//load the common stuff
			cliVorpalInstance.use(this._commonActions);
			cliVorpalInstance.use(this._subModuleCommonActions);
			//load the specific stuff
			cliVorpalInstance.use((vi) => {
				//kicking off the constructor is all that is needed to instantiate all the commands
				//we may want to add a lifecycle in the future...
				let cliModuleInst = new cliModuleClass(vi);
				
				let prompt = cliModuleInst.$prompt || cliModuleClass.$prompt || this._vorpalInstance.chalk.blue(`${cliName}>`);
				cliVorpalInstance.delimiter(prompt);
			});
		
			this._subModulesRegistry[cliName] = cliVorpalInstance;
		});
	}
	/****************************************************************/
	/* KICK OFF THE CLI or execute the command directly */
	/****************************************************************/
	run(){
		const parsedArgs = this._vorpalInstance.parse(process.argv, { use: 'minimist' });
		const interactive = parsedArgs._ === undefined || (_.isArray(parsedArgs._) && _.isEmpty(parsedArgs._));
		if (interactive) {
			this._vorpalInstance
				.delimiter(this._vorpalInstance.chalk.blue(this._prompt))
				.log(CLEAR_CODE)
				.show();
		}
		else {
			// argv is mutated by the first call to parse.
			process.argv.unshift('');
			process.argv.unshift('');
			let vorpalInstanceToExecute = this._vorpalInstance;
			//look to see if position 2 is in the registry if so manipulate
			if(this._subModulesRegistry[process.argv[2]]){
				vorpalInstanceToExecute = this._subModulesRegistry[process.argv[2]];
				process.argv.splice(2,1);
			}
			
			vorpalInstanceToExecute
				.log('Executing command directly: ' + parsedArgs._)
				.on('client_command_executed', () => process.exit(0))
				.delimiter('')
				.parse(process.argv);
		}
	}
}
module.exports=LarryCli;