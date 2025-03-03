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
        this.isUpdating = false;
        this.updateTimer = null;
    }

    async startPeriodicUpdates() {
        console.log('Starting periodic reputation updates');
        // Clear any existing timer
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        // Initial update immediately
        await this.updateReputationData();
        
        // Set up periodic updates
        this.updateTimer = setInterval(async () => {
            await this.updateReputationData();
        }, this.updateInterval);
    }

    // Add this new method to get reputation data
    async getReputations() {
        // If data is too old (more than 10 minutes) or empty, force an update
        const dataAge = Date.now() - this.lastUpdate;
        if (dataAge > 10 * 60 * 1000 || this.reputationData.size === 0) {
            console.log('Reputation data is stale or empty, updating...');
            try {
                await this.updateReputationData();
            } catch (error) {
                console.error('Failed to update reputation data:', error);
                return {
                    success: false,
                    message: 'Failed to update reputation data',
                    error: error.message
                };
            }
        }
        
        return {
            success: true,
            data: this.reputationData,
            lastUpdate: this.lastUpdate
        };
    }

    async updateReputationData() {
        if (this.isUpdating) {
            console.log('Update already in progress, skipping');
            return;
        }
        this.isUpdating = true;
        console.log('Starting reputation data update cycle');
        try {
            const connected = await this.connect(process.env.MINECRAFT_USERNAME || 'SantoriaDiscordBot');
            if (!connected) {
                console.error('Failed to connect for reputation update');
                this.isUpdating = false;
                return;
            }
            await new Promise(resolve => {
                const checkJoined = setInterval(() => {
                    if (this.serverJoined) {
                        clearInterval(checkJoined);
                        resolve();
                    }
                }, 1000);
                setTimeout(() => {
                    clearInterval(checkJoined);
                    resolve();
                }, 30000);
            });
            if (!this.serverJoined) {
                console.error('Failed to join Nations-Atlas server within timeout');
                this.disconnect();
                this.isUpdating = false;
                return;
            }
            try {
                // Add a delay to ensure the bot has time to join the correct server
                await new Promise(resolve => setTimeout(resolve, 5000));
                const validUsernameRegex = /^[a-zA-Z0-9_]{2,16}$/; 
                const playerNames = Object.keys(this.bot.players).filter(player => player !== this.bot.username)
                    .filter(player => player !== this.bot.username)
                    .filter(player => !player.includes('§'))
                    .filter(player => validUsernameRegex.test(player));
                console.log('Online players:', playerNames);
                this.reputationData.clear();
                for (const playerName of playerNames) {
                    try {
                        const repResponse = await this.sendCommand(`rep ${playerName}`);
                        const repMatch = repResponse.match(/(\w+)'s Reputation\s*([\w\s!]+)\s*\(([-\d]+) points\) \| \+?([-+\d]+)\/hr/);
                        if (repMatch) {
                            this.reputationData.set(playerName.toLowerCase(), {
                                name: playerName,
                                title: repMatch[2].trim(),
                                points: parseInt(repMatch[3]),
                                hourlyGain: parseInt(repMatch[4])
                            });
                            if (parseInt(repMatch[3]) <= 20) {
                                console.log(`⚠️ ${playerName} (${repMatch[3]})`);
                            } else {
                                console.log(`${playerName} (${repMatch[3]})`);
                            }
                        }
                    } catch (error) {
                        console.error(`Failed to get reputation for ${playerName}:`, error);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                this.lastUpdate = Date.now();
                console.log('Reputation data updated successfully');
                this.emit('reputationUpdate', this.reputationData);
            } catch (error) {
                console.error('Failed to get reputations:', error);
            }
            this.disconnect();
        } catch (error) {
            console.error('Error during reputation update cycle:', error);
        } finally {
            this.isUpdating = false;
        }
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
                this.serverJoined = true;
                console.log('Successfully joined Nations-Atlas server!');
            }, 5000); // Wait 5 seconds before sending command
            
            this.emit('connected');
        });

        this.bot.on('end', () => {
            console.log('Mineflayer bot disconnected');
            this.connected = false;
            this.serverJoined = false;
        });

        this.bot.on('error', (error) => {
            console.error('Mineflayer bot error:', error);
            if (this.bot) {
                this.bot.end();
            }
            this.connected = false;
            this.serverJoined = false;
        });

        this.bot.on('windowOpen', (window) => {
            // Log window data for debugging
            console.log('Window opened:', window.title);
        });

        this.bot.on('messagestr', (message) => {
            // Log important messages only
            if (message.includes('joined the game') || 
                message.includes('left the game') ||
                message.includes('server') ||
                message.includes('error')) {
                console.log('Chat message:', message);
            }
        });
        
        this.bot.on('kicked', (reason) => {
            console.log('Bot was kicked from server:', reason);
            this.connected = false;
            this.serverJoined = false;
            this.reconnectBot();
        });
        
        this.bot.on('error', (err) => {
            console.log('Mineflayer bot error:', err);
            this.connected = false;
            this.serverJoined = false;
            this.reconnectBot();
        });
    }

    async sendCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.bot) {
                reject(new Error('Bot not connected'));
                return;
            }
    
            const responseHandler = (message) => {
                // Remove listener after receiving a response
                if (this.bot) {
                    this.bot.removeListener('messagestr', responseHandler);
                }
                resolve(message);
            };
    
            // Set up listener for the response
            this.bot.once('messagestr', responseHandler);
    
            // Set a timeout in case no response is received
            const timeout = setTimeout(() => {
                if (this.bot) {
                    this.bot.removeListener('messagestr', responseHandler);
                }
                reject(new Error('Command timed out'));
            }, 5000);
    
            // Send the command
            this.bot.chat(`/${command}`);
        });
    }

    reconnectBot() {
        setTimeout(() => {
            console.log('Attempting to reconnect Mineflayer bot...');
            this.connectBot(); // Assuming connectBot is the method to connect the bot
        }, 10000); // Wait 10 seconds before attempting to reconnect
    }

    disconnect() {
        if (this.bot) {
            console.log('Disconnecting Mineflayer bot');
            this.bot.end();
            this.bot = null;
        }
        this.connected = false;
        this.serverJoined = false;
    }
    
    stop() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        this.disconnect();
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