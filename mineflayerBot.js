import mineflayer from 'mineflayer';
import { EventEmitter } from 'events';

class ReputationBot extends EventEmitter {
    constructor() {
        super();
        this.bot = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 60000; // 1 minute
        this.reputationData = new Map();
        this.lastUpdate = 0;
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.serverJoined = false;
    }

    async connect(username) {
        try {
            console.log('Connecting Mineflayer bot to Santoria...');
            this.bot = mineflayer.createBot({
                host: 'play.santoria.net',
                username: username, // unique identifier for cached auth
                auth: 'microsoft',
                version: '1.20.4'
            });

            this.setupEventHandlers();
            return true;
        } catch (error) {
            console.error('Failed to connect Mineflayer bot:', error);
            return false;
        }
    }

    setupEventHandlers() {
        // Remove existing listeners to avoid duplicates
        this.bot.removeAllListeners('login');
        this.bot.removeAllListeners('end');
        this.bot.removeAllListeners('error');
        this.bot.removeAllListeners('windowOpen');
        this.bot.removeAllListeners('messagestr');
        this.bot.removeAllListeners('kicked');

        this.bot.on('login', () => {
            console.log(`Mineflayer bot logged in as ${this.bot.username}`);
            this.connected = true;
            this.reconnectAttempts = 0;
            
            // Join the Nations-Atlas server after login
            console.log('Attempting to join Nations-Atlas server...');
            setTimeout(() => {
                this.bot.chat('/joinq Nations-Atlas');
                console.log('Successfully joined Nations-Atlas server!');
                this.serverJoined = true;
            }, 5000); // Wait 5 seconds before sending command
            
            this.emit('connected');
        });

        this.bot.on('end', () => {
            console.log('Mineflayer bot disconnected');
            this.connected = false;
            this.serverJoined = false;
            this.handleReconnect();
        });

        this.bot.on('error', (error) => {
            console.error('Mineflayer bot error:', error);
            if (this.bot) {
                this.bot.end();
            }
            this.connected = false;
            this.serverJoined = false;
            this.handleReconnect();
        });

        this.bot.on('windowOpen', (window) => {
            // Log window data for debugging
            console.log('Window opened:', window.title);
        });

        this.bot.on('messagestr', (message) => {
            // Log chat messages for debugging
            //console.log('Chat message:', message);
            
            // Check for server join confirmation
            /*if (message.includes('You have joined Nations-Atlas') || 
                message.includes('You are now in Nations-Atlas')) {
                console.log('Successfully joined Nations-Atlas server!');
                this.serverJoined = true;
            }*/
        });
        
        this.bot.on('kicked', (reason) => {
            console.log('Bot was kicked from server:', reason);
            this.connected = false;
            this.serverJoined = false;
            this.handleReconnect();
        });
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay / 1000} seconds...`);
            setTimeout(() => {
                this.connect(process.env.MINECRAFT_USERNAME || 'SantoriaDiscordBot');
            }, this.reconnectDelay);
        } else {
            console.log('Max reconnect attempts reached. Will not attempt to reconnect.');
            this.emit('maxReconnectAttempts');
        }
    }

    async getReputations() {
        if (!this.connected || !this.bot) {
            return { success: false, message: 'Bot not connected' };
        }
        
        if (!this.serverJoined) {
            return { success: false, message: 'Bot has not joined Nations-Atlas server yet' };
        }

        // Check if we have recent data
        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval && this.reputationData.size > 0) {
            return { 
                success: true, 
                data: this.reputationData,
                cached: true
            };
        }

        try {
            // Get online players using the '/list' command
            const playerNames = Object.keys(this.bot.players).filter(player => player !== this.bot.username);
            console.log('Online players:', playerNames);
            
            // Clear previous data
            this.reputationData.clear();
            
            // Get reputation for each player
            for (const playerName of playerNames) {
                try {
                    const repResponse = await this.sendCommand(`rep ${playerName}`);
                    //console.log(`Rep response for ${playerName}:`, repResponse);
                    
                    // Parse reputation from response
                    const repMatch = repResponse.match(/(\w+)'s Reputation\s*([\w\s!]+)\s*\(([-\d]+) points\) \| \+?([-+\d]+)\/hr/);
                    if (repMatch) {
                        this.reputationData.set(playerName, {
                            name: playerName,
                            title: repMatch[2].trim(),
                            points: parseInt(repMatch[3]),
                            hourlyGain: parseInt(repMatch[4])
                        });
                    //print playername and their reputation and add cauting sign if rep 20 or lower
                    if (parseInt(repMatch[3]) <= 20) {
                        console.log(`⚠️ ${playerName} (${repMatch[3]})`);
                    } else {
                        console.log(`${playerName} (${repMatch[3]})`);
                    }
                }
                } catch (error) {
                    console.error(`Failed to get reputation for ${playerName}:`, error);
                }
                
                // Add delay between commands to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            this.lastUpdate = now;
            //print every player's reputation
            this.reputationData.forEach((value, key) => {
                console.log(key, value);
            });
            return { 
                success: true, 
                data: this.reputationData,
                cached: false
            };
        } catch (error) {
            console.error('Failed to get reputations:', error);
            return { success: false, message: 'Error fetching reputation data' };
        }
    }

    async sendCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.bot) {
                reject(new Error('Bot not connected'));
                return;
            }

            const responseHandler = (message) => {
                // Remove listener after receiving a response
                this.bot.removeListener('messagestr', responseHandler);
                resolve(message);
            };

            // Set up listener for the response
            this.bot.once('messagestr', responseHandler);

            // Set a timeout in case no response is received
            const timeout = setTimeout(() => {
                this.bot.removeListener('messagestr', responseHandler);
                reject(new Error('Command timed out'));
            }, 5000);

            // Send the command
            this.bot.chat(`/${command}`);
        });
    }

    disconnect() {
        if (this.bot) {
            this.bot.end();
            this.bot = null;
        }
        this.connected = false;
        this.serverJoined = false;
    }
}

// Singleton instance
let botInstance = null;

export const getMineflayerBot = () => {
    if (!botInstance) {
        botInstance = new ReputationBot();
    }
    return botInstance;
};