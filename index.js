import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import 'dotenv/config';
import { data as landData, execute as landExecute, autocomplete as landAutocomplete } from './commands/land.js';
import { data as playersData, execute as playersExecute } from './commands/players.js';
import { data as trackData, execute as trackExecute } from './commands/track.js';
import { data as untrackData, execute as untrackExecute, autocomplete as untrackAutocomplete } from './commands/untrack.js';
import { data as repData, execute as repExecute } from './commands/rep.js';
import { data as trackedData, execute as trackedExecute } from './commands/tracked.js';
import { checkTrackers } from './trackers.js';
import { initTrackers } from './trackers.js';
import { getMineflayerBot } from './mineflayerBot.js';
// import { getTestBot } from './testBot.js'; // Import the new test bot

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const MINECRAFT_USERNAME = process.env.MINECRAFT_USERNAME || 'SantoriaDiscordBot';
const ENABLE_MINEFLAYER = process.env.ENABLE_MINEFLAYER === 'true'; // Read the toggle

if (!TOKEN || !CLIENT_ID) {
    console.error("Missing Discord environment variables (TOKEN or CLIENT_ID)");
    process.exit(1);
}

const commands = [landData, playersData, trackData, untrackData, repData, trackedData];

// let testBotInstance = null; // Declare testBotInstance here - REMOVED

client.on('ready', async () => {
    console.log('ENABLE_MINEFLAYER:', process.env.ENABLE_MINEFLAYER, '=>', ENABLE_MINEFLAYER);
    console.log(`Logged in as ${client.user.tag}`);
    await initTrackers();
    
    // Conditionally start periodic reputation updates
    if (ENABLE_MINEFLAYER) {
        const bot = getMineflayerBot();
        bot.startPeriodicUpdates().catch(error => {
            console.error("Failed to start reputation updates:", error);
        });
        // testBotInstance = getTestBot(); // Get the test bot instance - REMOVED
        // testBotInstance.start().catch(error => { // Start the test bot - REMOVED
        //     console.error("Failed to start TestBot:", error); - REMOVED
        // });
    } else {
        console.log('Mineflayer features are disabled.');
    }
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    console.log('Attempting to register global slash commands...');
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully registered global slash commands.');
    } catch (error) {
        console.error('Error registering global commands:', error);
        if (error.rawError) {
            console.error('Discord API Error Details:', error.rawError);
        }
    }
    
    setInterval(() => checkTrackers(client), 30000);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        switch (interaction.commandName) {
            case 'land': return await landAutocomplete(interaction);
            case 'untrack': return await untrackAutocomplete(interaction);
        }
        return;
    }
    
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('show_land_info_')) {
            const landName = interaction.customId.replace('show_land_info_', '').replace(/_/g, ' ');
            // Create a mock interaction object for the land command
            const mockInteraction = {
                options: {
                    getString: (name) => {
                        if (name === 'name') return landName;
                        return null;
                    }
                },
                reply: interaction.reply.bind(interaction),
                editReply: interaction.editReply.bind(interaction),
                deferReply: interaction.deferReply.bind(mockInteraction), // Corrected binding
                user: interaction.user,
                guildId: interaction.guildId,
                channelId: interaction.channelId,
                // Add other properties if landExecute requires them
            };
            await landExecute(mockInteraction);
        }
        return;
    }
    
    if (!interaction.isCommand()) return;
    
    switch (interaction.commandName) {
        case 'untrack': await untrackExecute(interaction); break;
        case 'land': await landExecute(interaction); break;
        case 'players': await playersExecute(interaction); break;
        case 'track': await trackExecute(interaction); break;
        case 'rep': await repExecute(interaction); break;
        case 'tracked': await trackedExecute(interaction); break;
    }
});

// Handle process exit
process.on('SIGINT', () => {
    console.log('Shutting down...');
    // if (ENABLE_MINEFLAYER && testBotInstance) { // Check if testBotInstance exists - REMOVED
    //     testBotInstance.stop(); // Stop the test bot - REMOVED
    // }
    if (ENABLE_MINEFLAYER) {
        const bot = getMineflayerBot();
        bot.stop();
    }
    process.exit(0);
});

client.login(TOKEN);
