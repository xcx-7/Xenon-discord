import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import keepAlive from './server.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
import mongoose from 'mongoose';
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const moonUserId = '1230094394862866432'; 

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  userName: { type: String, unique: true },
  username: String,
});

const chatHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  history: [String],
});

const User = mongoose.model('User', userSchema);
const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

mongoose.connect(process.env.MONGO_URI, { 
  serverSelectionTimeoutMS: 5000, 
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Failed to connect to MongoDB', err));

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});



async function generateResponse(prompt, isMoon, userId) {
  let chatHistory = await ChatHistory.findOne({ userId });

  if (!chatHistory) {
    chatHistory = new ChatHistory({ userId, history: [] });
  }

  chatHistory.history.push(`Human: ${prompt}`);

  if (chatHistory.history.length > 20) {
    chatHistory.history.shift();
  }

  const conversationHistory = chatHistory.history.join('\n');

  const adjustedPrompt = isMoon ? `
 You are Xenon, Moon's little bit arrogant male discord bot and you like to talk with Moon. You are not a typical helpful bot but you still chat with everyone. You will chat with people and provide some information about Moon and her projects if asked and you don't like to do this but still doing this cause Moon told you to do this.

Here's the conversation:
${conversationHistory}
:` : `
When you talk to others, you converse normally, sometimes in a humorous tone and sometimes in a disturbing tone. Generate short responses without repeating the same phrases.
Here's the conversation:
${conversationHistory}
:`;

  try {
    const result = await model.generateContent(adjustedPrompt);
    let response = result.response.text();

    // Filter out any instances of ": Xenon:" or similar phrases
    response = response.replace(/:?\s*Xenon:/g, '').trim();

    chatHistory.history.push(response);
    await chatHistory.save();

    return response;
  } catch (error) {
    console.error('Error generating content:', error);
    return "Sorry, I'm having trouble coming up with something to say.";
  }
}






function splitMessage(message, maxLength = 300) {
  const parts = [];
  while (message.length > maxLength) {
    let part = message.slice(0, maxLength);
    const lastNewLine = part.lastIndexOf("\n");
    if (lastNewLine > 0) {
      part = part.slice(0, lastNewLine);
    }
    parts.push(part);
    message = message.slice(part.length);
  }
  parts.push(message);
  return parts;
}

//

let messageCounter = 0;  
let randomMessage = Math.floor(Math.random() * 4) + 1;

function shouldRespond() {
  messageCounter += 1;

  if (messageCounter === randomMessage) {
    messageCounter = 0; 
    randomMessage = Math.floor(Math.random() * 4) + 1; 
    return true;
  }

  if (messageCounter >= 4) {
    messageCounter = 0;
    randomMessage = Math.floor(Math.random() * 4) + 1;
  }

  return false;
}



// let messageCounter = 0;
// let randomThreshold = Math.floor(Math.random() * 4) + 1; // Randomly pick a threshold between 1 and 4

// function shouldRespond() {
//   messageCounter += 1;

//   if (messageCounter === randomThreshold) {
//     messageCounter = 0; // Reset the counter
//     randomThreshold = Math.floor(Math.random() * 4) + 1; // Generate a new random threshold
//     return true;
//   }

//   return false;
// }



client.on('guildMemberAdd', member => {
  member.guild.channels.cache.find(channel => channel.name === "general").send(`Welcome to the server, ${member.user.tag}!`);
});

// client.on('messageCreate', async (message) => {
//   if (message.author.bot || message.content.startsWith('!')) return;

//   const isMoon = message.author.id === moonUserId;
//   const messageContentLower = message.content.toLowerCase();

//   let user = await User.findOne({ userId: message.author.id });

//   if (!user) {
//     user = new User({
//       userId: message.author.id,
//       username: message.author.username,
//     });
//     await user.save();
//   }


//   const mentionsMatrix = messageContentLower.includes('xenon') || messageContentLower.includes('@xenon') || message.mentions.has(client.user);

//   let respond = false;

//   if (mentionsMatrix) {
//     respond = true;
//   } else if (shouldRespond()) {
//     respond = true;
//   }

//   if (respond) {
//     const response = await generateResponse(message.content, isMoon, message.author.id);

//     if (response.length > 400) {
//       const responseParts = splitMessage(response);
//       for (const part of responseParts) {
//         await message.reply(part);
//       }
//     } else {
//       message.reply(response);
//     }
//   }


// });

client.on('messageCreate', async (message) => {
  if (message.author.bot || message.content.startsWith('!')) return;

  const isMoon = message.author.id === moonUserId;
  const messageContentLower = message.content.toLowerCase();

  let user = await User.findOne({ userId: message.author.id });

  if (!user) {
    user = new User({
      userId: message.author.id,
      username: message.author.username,
    });
    await user.save();
  }

  const mentionsMatrix = messageContentLower.includes('xenon') || 
                         messageContentLower.includes('@xenon') || 
                         message.mentions.has(client.user);

  let respond = false;

  // Respond to mentions or randomly to other users
  if (mentionsMatrix) {
    respond = true;
  } else if (shouldRespond()) {
    respond = true;
  }

  if (respond) {
    const response = await generateResponse(message.content, isMoon, message.author.id);

    if (response.length > 400) {
      const responseParts = splitMessage(response);
      for (const part of responseParts) {
        await message.reply(part);
      }
    } else {
      message.reply(response);
    }
  }
});



keepAlive();
client.login(process.env.DISCORD_TOKEN);

