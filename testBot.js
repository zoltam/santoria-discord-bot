import mineflayer from 'mineflayer';
import { EventEmitter } from 'events';

class TestBot extends EventEmitter {
    constructor() {
        super();
        this.bot = null;
        this.connected = false;
        this.serverJoined = false; // To track if we've joined Nations-Atlas
    }

    async start() {
        console.log('Starting TestBot...');
        try {
            await this.connect(process.env.MINECRAFT_USERNAME || 'SantoriaDiscordBot');
            console.log('TestBot connected to hub.');

            // Wait 1 second after connecting to the hub
            console.log('Waiting 1 second before sending /joinq Nations-Atlas command...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Send /joinq Nations-Atlas command
            console.log('Sending /joinq Nations-Atlas command...');
            this.bot.chat('/joinq Nations-Atlas');
            console.log('/joinq Nations-Atlas command sent. Waiting for server join confirmation...');

            // Listener for [Lands] message to confirm server join
            const onLandsMessage = (message) => {
                if (message.includes('[Lands]')) {
                    this.serverJoined = true;
                    console.log('Successfully joined Nations-Atlas server ([Lands] message detected)!');
                    this.bot.removeListener('messagestr', onLandsMessage); // Remove this listener once triggered
                }
            };
            this.bot.on('messagestr', onLandsMessage);

            // Original spawn event listener (as a fallback/additional confirmation)
            this.bot.once('spawn', () => {
                if (!this.serverJoined) { // Only log if not already set by [Lands] message
                    this.serverJoined = true;
                    console.log('Successfully joined Nations-Atlas server (spawn event after /joinq detected)!');
                }
            });

        } catch (error) {
            console.error('TestBot failed to start:', error);
        }
    }

    async connect(username) {
        return new Promise((resolve, reject) => {
            if (this.connected && this.bot) {
                console.log('TestBot already connected.');
                return resolve(true);
            }

            console.log('Connecting TestBot to Santoria...');
            try {
                this.bot = mineflayer.createBot({
                    host: 'play.santoria.net',
                    username: username,
                    auth: 'microsoft',
                    version: '1.20.4'
                });

                this.setupEventHandlers();

                const loginTimeout = setTimeout(() => {
                    this.bot.end();
                    reject(new Error('TestBot login timed out'));
                }, 30000); // 30 seconds timeout for login

                this.bot.once('login', () => {
                    clearTimeout(loginTimeout);
                    this.connected = true;
                    resolve(true);
                });

                this.bot.once('error', (err) => {
                    clearTimeout(loginTimeout);
                    reject(err);
                });

                this.bot.once('end', () => {
                    clearTimeout(loginTimeout);
                    if (!this.connected) {
                        reject(new Error('TestBot disconnected before login.'));
                    }
                    this.connected = false;
                    this.serverJoined = false;
                    console.log('TestBot disconnected.');
                });

            } catch (error) {
                console.error('Failed to create TestBot:', error);
                reject(error);
            }
        });
    }

    setupEventHandlers() {
        // Remove existing listeners to avoid duplicates
        this.bot.removeAllListeners('login');
        this.bot.removeAllListeners('end');
        this.bot.removeAllListeners('error');
        this.bot.removeAllListeners('windowOpen');
        this.bot.removeAllListeners('messagestr');
        this.bot.removeAllListeners('kicked');
        this.bot.removeAllListeners('spawn'); // Ensure no old spawn listeners interfere

        this.bot.on('messagestr', (message) => {
            // Log all chat messages for debugging
            console.log(`TestBot Chat message (serverJoined: ${this.serverJoined}): ${message}`);
        });
        
        this.bot.on('kicked', (reason) => {
            console.log('TestBot was kicked from server:', reason);
            this.connected = false;
            this.serverJoined = false;
            // No reconnect logic in test bot, just log
        });
        
        this.bot.on('error', (err) => {
            console.error('TestBot error:', err);
            if (this.bot) {
                this.bot.end();
            }
            this.connected = false;
            this.serverJoined = false;
        });
    }

    stop() {
        if (this.bot) {
            console.log('Stopping TestBot...');
            this.bot.end();
            this.bot = null;
        }
        this.connected = false;
        this.serverJoined = false;
    }

    async waitForChat(regex, timeout = 15000) { // Increased default timeout for robustness
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.bot.removeListener('messagestr', onMessage);
                reject(new Error(`Timed out waiting for chat message matching ${regex}`));
            }, timeout);

            const onMessage = (message) => {
                if (regex.test(message)) {
                    clearTimeout(timer);
                    this.bot.removeListener('messagestr', onMessage);
                    resolve(message);
                }
            };
            this.bot.on('messagestr', onMessage);
        });
    }
}

// Singleton instance for the test bot
let testBotInstance = null;

export const getTestBot = () => {
    if (!testBotInstance) {
        testBotInstance = new TestBot();
    }
    return testBotInstance;
};
