class MessageHandler
{
    /*
    Initializes a new instance of the Message Handler
    */

    constructor(parent)
    {
        this.parent = parent;
        this.linkify = require('linkifyjs');
        this.exec = require('child_process').exec;
        this.profanity = require('../lib/profanity-util');
        this.fs = require('fs');
        this.shell = require('shelljs');
        this.RESTCLIENT = require('node-rest-client').Client;
        this.rest_client = new this.RESTCLIENT();
        this.replaceList = {
            '!': 'i',
            '0': 'o',
            'l': 'i',
            '1': 'i'
        }

        this.registerRESTEvents();
    }

    /*
    Registers all REST events
    */

    registerRESTEvents()
    {
        this.rest_client.registerMethod("post", `${Config.WebServer.Protocol}://${Config.WebServer.Link}/v1/logs/`, "POST");
    }

    /*
    Checks a message
    */

    async checkNormal(message)
    {
        if (message.author.bot === true)
        {
            return;
        }

        var channel = message.channel.name;
        var channelId = message.channel.id;
    	var author = message.author.username;
        var uid = message.author.id;
    	var msg = message.content;
    	var date = message.createdAt;

        if (Config.Server.LogMessages === true)
        {
            //Logger.debug(`(${channel}) - ${uid} - ${author}: ${msg}`);
        }

        if ((msg === '-down') && (Config.Server.Admins.includes(uid)))
        {
            await message.reply('shutting down!');
            await process.exit();
        }

        if ((msg === '-update') && (Config.Server.Admins.includes(uid)))
        {

            await message.reply('updating...');

            await this.exec('sh update.sh',
            (err, out, stderr) =>
                {
                    message.reply(`reply: ${out}`);

                    if (err !== null)
                    {
                        message.reply(`exec error: ${err}`);
                    }
                }
            );

            //await message.reply('updated code!');
        }

        if (message.channel.type == "dm")
        {
            const embed = new Discord.RichEmbed()
              .setDescription('Greetings from the official Toontown: Corporate Clash bot. \nYou may use these mediums to get in contact with our team!\n')

              .setColor('#1abc9c')
              .setFooter("© Corporate Clash 2017-2018")

              .setTimestamp()
              .addField('ModMail', "<@397403358782029825>", true)
              .addField('Email', "support@corporateclash.net", true)

             message.reply(
                 {
                     embed
                 }
             );
        }

        if (message.channel.type == "text")
        {
            // Check that the user has data, if not then create the dummy data
            if(uid !== this.parent.bot.user.id)
            {
                try
                {
                    var user_data = Database.getData(`/${uid}/suggestion_count[0]`);
                }
                catch(err)
                {
                    if (err.message.startsWith('Can\'t find dataPath:'))
                    {
                        Database.push(`/${uid}/suggestion_count[]`, {
                            "uv": 0,
                            "dv": 0
                        }, true);
                    }
                }
            }

            let c_msg = this.replace(msg, this.replaceList);
            var checkLink = this.checkLink(c_msg, channelId);
            var checkMsg = this.checkProfanity(c_msg);

            if ((checkLink[0] === true) && (this.checkPerms(message, uid) === false))
            {
                Database.push(`/${uid}/link_infractions[]/`, {
                    content: msg,
                    detected_links: checkLink[1]
                }, true);

                if (msg.length >= 600)
                {
                    msg = msg.substring(0, 500);
                }

                const embed = new Discord.RichEmbed()
                  .setDescription('Our bot has detected you sending invalid links!\nPlease remember the Corporate Clash rules.\n')
                  .setAuthor(author, await this.getAvatar(uid))

                  .setColor('#FF0000')
                  .setFooter("© Corporate Clash 2017-2018")

                  .setTimestamp()
                  .addField('**Message**', "```" + msg + "```", true)
                  .addField('**Detected Link**', "```" + checkLink[1] + "```", true)

                 message.author.send(
                     {
                         embed
                     }
                 );

                 message.delete();
            }

            if (checkMsg[0] === 1)
            {
                Database.push(`/${uid}/profanity_warnings[]/`, {
                    content: msg,
                    detected_word: checkMsg[1]
                }, true);

                if (msg.length >= 600)
                {
                    msg = msg.substring(0, 500);
                }

                const embed = new Discord.RichEmbed()
                  .setDescription('Our bot has detected you swearing!\nPlease remember no NFSW language is allowed in the Corporate Clash discord.\n')
                  .setAuthor(author, await this.getAvatar(uid))

                  .setColor('#FF0000')
                  .setFooter("© Corporate Clash 2017-2018")

                  .setTimestamp()
                  .addField('**Message**', "```" + msg + "```", true)
                  .addField('**Detected Word**', "```" + checkMsg[1] + "```", true)
                  .addField('**Profanity Warnings**', "```" + this.parent.stats_hndler.getProfanityStats(uid) + "```", true);

                 message.author.send(
                     {
                         embed
                     }
                 );

                 if (Config.Server.LogMessages === true)
                 {

                     if (msg.length >= 600)
                     {
                         msg = msg.substring(0, 500);
                     }

                     const embed = new Discord.RichEmbed()
                       .setDescription(`A message by ${author} has been deleted for profanity.`)
                       .setAuthor(author, await this.getAvatar(uid))

                       .setColor('#FF0000')
                       .setFooter("© Corporate Clash 2017-2018")

                       .setTimestamp()
                       .addField('**Original Message**', "```" + msg + "```", true)
                       .addField('**Detected Word**', "```" + checkMsg[1] + "```", true)
                       .addField('**Channel**', "```#" + channel + "```", true)
                       .addField('**User ID**', "```" + uid + "```", true)
                       .addField('**Profanity Warnings**', "```" + this.parent.stats_hndler.getProfanityStats(uid) + "```", true);

                     this.sendChannelMessage(embed, Config.Server.Channels.Moderation);
                 }

                message.delete();
            }
            else
            {
                this.handleMessage(message);
            }
        }
    }

    /*
    Handles a deleted message
    */

    async handleDelete(message)
    {
        if (message.author.bot === true)
        {
            return;
        }

        var channel = message.channel.name;
    	var author = message.author.username;
        var uid = message.author.id;
    	var msg = message.content;
    	var date = message.createdAt;

        if (Config.Server.LogMessages === true)
        {
            //Logger.debug(`(${channel}) - ${uid} - ${author}: ${msg}`);

            if (msg.length >= 600)
            {
                msg = msg.substring(0, 500);
            }

            const embed = new Discord.RichEmbed()
              .setDescription(`A message by ${author} has been deleted.`)
              .setAuthor(author, await this.getAvatar(uid))

              .setColor('#800080')
              .setFooter("© Corporate Clash 2017-2018")

              .setTimestamp()
              .addField('**Original Message**', "```" + msg + "```", true)
              .addField('**Channel**', "```#" + channel + "```", true)
              .addField('**User ID**', "```" + uid + "```", true);

            this.sendChannelMessage(embed, Config.Server.Channels.Logging);
        }
    }

    /*
    Checks an edited message
    */

    async checkEdit(old_message, new_message)
    {
        if (new_message.author.bot === true)
        {
            return;
        }

        var channel = new_message.channel.name;
    	var author = new_message.author.username;
        var uid = new_message.author.id;
    	var msg = new_message.content;
        var omsg = old_message.content;
    	var date = new_message.createdAt;

        if (Config.Server.LogMessages === true)
        {
            //Logger.debug(`EDITED message: (${channel}) - ${uid} - ${author}: ${msg}`);

            if (msg.length >= 600)
            {
                msg = msg.substring(0, 500);
            }

            const embed = new Discord.RichEmbed()
              .setDescription(`A message by ${author} has been edited.`)
              .setAuthor(author, await this.getAvatar(uid))

              .setColor('#800080')
              .setFooter("© Corporate Clash 2017-2018")

              .setTimestamp()
              .addField('**Original Message**', "```" + omsg + "```", true)
              .addField('**Edited Message**', "```" + msg + "```", true)
              .addField('**Channel**', "```#" + channel + "```", true)
              .addField('**User ID**', "```" + uid + "```", true);

            this.sendChannelMessage(embed, Config.Server.Channels.Logging);
        }

        if (new_message.channel.type == "text")
        {

            let c_msg = this.replace(msg, this.replaceList);
            var checkLink = this.checkLink(c_msg, channel);
            var checkMsg = this.checkProfanity(c_msg);

            if ((checkLink[0] === true) && (this.checkPerms(new_message, uid) === false))
            {
                Database.push(`/${uid}/link_infractions[]/`, {
                    content: msg,
                    detected_links: checkLink[1]
                }, true);

                if (msg.length >= 600)
                {
                    msg = msg.substring(0, 500);
                }

                const embed = new Discord.RichEmbed()
                  .setDescription('Our bot has detected you sending invalid links!\nPlease remember the Corporate Clash rules.\n')
                  .setAuthor(author, await this.getAvatar(uid))

                  .setColor('#FF0000')
                  .setFooter("© Corporate Clash 2017-2018")

                  .setTimestamp()
                  .addField('**Message**', "```" + msg + "```", true)
                  .addField('**Detected Link**', "```" + checkLink[1] + "```", true)

                 new_message.author.send(
                     {
                         embed
                     }
                 );

                 new_message.delete();
            }

            if (checkMsg[0] === 1)
            {
                Database.push(`/${uid}/profanity_warnings[]/`, {
                    content: msg,
                    detected_word: checkMsg[1]
                }, true);

                if (msg.length >= 600)
                {
                    msg = msg.substring(0, 500);
                }

                const embed = new Discord.RichEmbed()
                  .setDescription('Our bot has detected you swearing!\nPlease remember no NFSW language is allowed in the Corporate Clash discord.\n')
                  .setAuthor(author, await this.getAvatar(uid))

                  .setColor('#FF0000')
                  .setFooter("© Corporate Clash 2017-2018")

                  .setTimestamp()
                  .addField('**Original Message**', "```" + omsg + "```", true)
                  .addField('**Edited Message**', "```" + msg + "```", true)
                  .addField('**Detected Word**', "```" + checkMsg[1] + "```", true)
                  .addField('**Profanity Warnings**', "```" + this.parent.stats_hndler.getProfanityStats(uid) + "```", true);

                 new_message.author.send(
                     {
                         embed
                     }
                 );

                 if (Config.Server.LogMessages === true)
                 {

                     if (msg.length >= 600)
                     {
                         msg = msg.substring(0, 500);
                     }

                     const embed = new Discord.RichEmbed()
                       .setDescription(`A message by ${author} that had been edited, has been deleted for profanity.`)
                       .setAuthor(author, await this.getAvatar(uid))

                       .setColor('#FF0000')
                       .setFooter("© Corporate Clash 2017-2018")

                       .setTimestamp()
                       .addField('**Original Message**', "```" + omsg + "```", true)
                       .addField('**Edited Message**', "```" + msg + "```", true)
                       .addField('**Detected Word**', "```" + checkMsg[1] + "```", true)
                       .addField('**Channel**', "```#" + channel + "```", true)
                       .addField('**User ID**', "```" + uid + "```", true)
                       .addField('**Profanity Warnings**', "```" + this.parent.stats_hndler.getProfanityStats(uid) + "```", true);

                    this.sendChannelMessage(embed, Config.Server.Channels.Moderation);
                 }

                new_message.delete();
            }
            else
            {
                this.handleMessage(new_message);
            }
        }
    }

    /*
    Main message handler that processes messages after being checked
    */

    async handleMessage(message)
    {
        var channel = message.channel.name;
        var channelId = message.channel.id;
    	var author = message.author.username;
        var uid = message.author.id;
    	var msg = message.content;
    	var date = message.createdAt;

        if (channelId === Config.Server.Channels.Suggestions)
        {
            await message.react("✅");
            await message.react("❌");
        }

        if (channelId === Config.Server.Channels.ToonHQ)
        {
            if (msg === `${Config.Server.Prefix}leaderboard`)
            {
                let top_ten = this.parent.stats_hndler.getTopTen();

                const embed = new Discord.RichEmbed()
                    .setDescription('**__Top 10 Leaderboard__**\n')

                  .setColor('#00ff00')
                  .setFooter("© Corporate Clash 2017-2018")

                  .setTimestamp()
                  .addField(`**1. ${await this.getAVName(top_ten[0].uid)}**`, `** Total Score: __${top_ten[0].total}__**`, true)
                  .addField(`**2. ${await this.getAVName(top_ten[1].uid)}**`, `** Total Score: __${top_ten[1].total}__**`, true)
                  .addField(`**3. ${await this.getAVName(top_ten[2].uid)}**`, `** Total Score: __${top_ten[2].total}__**`, true)
                  .addField(`**4. ${await this.getAVName(top_ten[3].uid)}**`, `** Total Score: __${top_ten[3].total}__**`, true)
                  .addField(`**5. ${await this.getAVName(top_ten[4].uid)}**`, `** Total Score: __${top_ten[4].total}__**`, true)
                  .addField(`**6. ${await this.getAVName(top_ten[5].uid)}**`, `** Total Score: __${top_ten[5].total}__**`, true)
                  .addField(`**7. ${await this.getAVName(top_ten[6].uid)}**`, `** Total Score: __${top_ten[6].total}__**`, true)
                  .addField(`**8. ${await this.getAVName(top_ten[7].uid)}**`, `** Total Score: __${top_ten[7].total}__**`, true)
                  .addField(`**9. ${await this.getAVName(top_ten[8].uid)}**`, `** Total Score: __${top_ten[8].total}__**`, true)
                  .addField(`**10. ${await this.getAVName(top_ten[9].uid)}**`, `** Total Score: __${top_ten[9].total}__**`, true)


                this.sendChannelMessage(embed, Config.Server.Channels.ToonHQ);
            }

            if ((msg === `${Config.Server.Prefix}sadboard`) || (msg === `${Config.Server.Prefix}):`))
            {
                /*
                let last_ten = this.parent.stats_hndler.getLastTen();

                const embed = new Discord.RichEmbed()
                    .setDescription('**__SAD! board ):__**\n')

                  .setColor('#00ff00')
                  .setFooter("© Corporate Clash 2017-2018")

                  .setTimestamp()
                  .addField(`**1. ${await this.getAVName(last_ten[0].uid)}**`, `** Total Score: __${last_ten[0].total}__**`, true)
                  .addField(`**2. ${await this.getAVName(last_ten[1].uid)}**`, `** Total Score: __${last_ten[1].total}__**`, true)
                  .addField(`**3. ${await this.getAVName(last_ten[2].uid)}**`, `** Total Score: __${last_ten[2].total}__**`, true)
                  .addField(`**4. ${await this.getAVName(last_ten[3].uid)}**`, `** Total Score: __${last_ten[3].total}__**`, true)
                  .addField(`**5. ${await this.getAVName(last_ten[4].uid)}**`, `** Total Score: __${last_ten[4].total}__**`, true)
                  .addField(`**6. ${await this.getAVName(last_ten[5].uid)}**`, `** Total Score: __${last_ten[5].total}__**`, true)
                  .addField(`**7. ${await this.getAVName(last_ten[6].uid)}**`, `** Total Score: __${last_ten[6].total}__**`, true)
                  .addField(`**8. ${await this.getAVName(last_ten[7].uid)}**`, `** Total Score: __${last_ten[7].total}__**`, true)
                  .addField(`**9. ${await this.getAVName(last_ten[8].uid)}**`, `** Total Score: __${last_ten[8].total}__**`, true)
                  .addField(`**10. ${await this.getAVName(last_ten[9].uid)}**`, `** Total Score: __${last_ten[9].total}__**`, true)

                  */

                this.sendChannelMessage('Sorry, this feature has been removed.', Config.Server.Channels.ToonHQ);
            }

            if (msg.startsWith(`${Config.Server.Prefix}stats`))
            {
                if (message.mentions.members.first() != undefined)
                {
                    uid = message.mentions.members.first().id;
                }

                let suggestion_count = this.parent.stats_hndler.getSuggestionStats(uid);
                let uv = parseInt(suggestion_count.uv);
                let dv = parseInt(suggestion_count.dv);
                let total = (uv) - (dv);
                let name = await this.getAVName(uid);
                let a_url = await this.getAvatar(uid);

                if (uid === '296476753298456577')
                {
                    let infinity = String.fromCharCode(8734);
                        uv = infinity;
                        dv = infinity;
                        total = infinity;
                }

                const embed = new Discord.RichEmbed()
                  .setAuthor(`${name}'s stats`, a_url)

                  .setColor('#00ff00')
                  .setFooter("© Corporate Clash 2017-2018")

                  .setTimestamp()
                  .addField('**Upvotes**', `**${uv}**`, true)
                  .addField('**Downvotes**', `**${dv}**`, true)
                  .addField('**Total Score**', `**${total}**`, true)


                this.sendChannelMessage(embed, Config.Server.Channels.ToonHQ);
            }
        }

        if (channelId === Config.Server.Channels.Moderation)
        {
            if ((msg.startsWith(`${Config.Server.Prefix}user`)) && (this.checkPerms(message, uid) === true))
            {
                let split_msg = msg.split(' ');
                let target_id = split_msg[1];
                let u_member = await this.getUser(target_id);

                if (target_id === undefined)
                {
                    message.reply('please supply the target user\'s id!')
                }
                else if (u_member === undefined)
                {
                    message.reply('this user does not exist!')
                }
                else
                {
                    let g_member = this.getMember(target_id);

                    if (g_member)
                    {
                        let suggestion_count = this.parent.stats_hndler.getSuggestionStats(target_id);
                        let uv = parseInt(suggestion_count.uv);
                        let dv = parseInt(suggestion_count.dv);
                        let total = (uv) - (dv);

                        const embed = new Discord.RichEmbed()
                          .setDescription('**User Information**\n')
                          .setAuthor(u_member.username, await this.getAvatar(u_member.id))

                          .setColor('#33CCCC')
                          .setFooter("© Corporate Clash 2017-2018")

                          .setTimestamp()
                          .setImage(u_member.avatarURL)

                          .addField('**ID**', u_member.id, true)
                          .addField('**Username**', u_member.username, true)
                          .addField('**Tag**', u_member.tag, true)
                          .addField('**Avatar URL**', u_member.avatarURL, true)
                          .addField('**Is bot?**', u_member.bot, true)

                          .addField('**Account Creation**', u_member.createdAt, true)
                          .addField('**Highest Role**', g_member.highestRole, true)
                          .addField('**Join Date**', g_member.joinedAt, true)
                          .addField('**Display Name**', g_member.displayName, true)

                          .addField('**Profanity Warnings**', this.parent.stats_hndler.getProfanityStats(target_id), true)
                          .addField('**Moderation Warnings**', this.parent.stats_hndler.getModPoints(target_id), true)
                          .addField('**Kick Points**', this.parent.stats_hndler.getKickPoints(target_id), true)
                          .addField('**Ban Points**', this.parent.stats_hndler.getBanPoints(target_id), true)

                          .addField('**HQ Limit**', this.checkRole(target_id, Config.Roles.HQLimit), true)
                          .addField('**Art Limit**', this.checkRole(target_id, Config.Roles.ArtLimit), true)
                          .addField('**Suggestion Limit**', this.checkRole(target_id, Config.Roles.SuggestionLimit), true)
                          .addField('**Muted**', this.checkRole(target_id, Config.Roles.Mute), true)

                          .addField('**Upvotes**', `**${uv}**`, true)
                          .addField('**Downvotes**', `**${dv}**`, true)
                          .addField('**Total Score**', `**${total}**`, true)

                        this.sendChannelMessage(embed, Config.Server.Channels.Moderation);
                    }
                    else
                    {
                        let suggestion_count = this.parent.stats_hndler.getSuggestionStats(target_id);
                        let uv = parseInt(suggestion_count.uv);
                        let dv = parseInt(suggestion_count.dv);
                        let total = (uv) - (dv);

                        const embed = new Discord.RichEmbed()
                          .setDescription('**User Information**\n')
                          .setAuthor(u_member.username, await this.getAvatar(u_member.id))

                          .setColor('#33CCCC')
                          .setFooter("© Corporate Clash 2017-2018")

                          .setTimestamp()
                          .setImage(u_member.avatarURL)

                          .addField('**ID**', u_member.id, true)
                          .addField('**Username**', u_member.username, true)
                          .addField('**Tag**', u_member.tag, true)
                          .addField('**Avatar URL**', u_member.avatarURL, true)
                          .addField('**Is bot?**', u_member.bot, true)

                          .addField('**Account Creation**', u_member.createdAt, true)

                          .addField('**Profanity Warnings**', this.parent.stats_hndler.getProfanityStats(target_id), true)
                          .addField('**Moderation Warnings**', this.parent.stats_hndler.getModPoints(target_id), true)
                          .addField('**Kick Points**', this.parent.stats_hndler.getKickPoints(target_id), true)
                          .addField('**Ban Points**', this.parent.stats_hndler.getBanPoints(target_id), true)

                          .addField('**Upvotes**', `**${uv}**`, true)
                          .addField('**Downvotes**', `**${dv}**`, true)
                          .addField('**Total Score**', `**${total}**`, true)

                        this.sendChannelMessage(embed, Config.Server.Channels.Moderation);
                    }
                }
            }
            else if ((msg.startsWith(`${Config.Server.Prefix}user`)) && (this.checkPerms(message, uid) === false))
            {
                message.author.send('sorry but you don\'t have the proper permissions to execute this command!')
            }

            if ((msg.startsWith(`${Config.Server.Prefix}remove`)) && (this.checkPerms(message, uid) === true))
            {
                var split_msg = msg.split(' ');
                var target_id = split_msg[1];
                var g_member = this.getMember(target_id)
                var log_type = this.removeFirstTwoParams(msg);
                var log_type = log_type.split(' ')[0];
                var check_type = this.checkLogType(log_type);
                var item_id = parseInt(this.removeFirstThreeParams(msg));
                var item = item_id;

                if (target_id === undefined)
                {
                    message.reply('please supply the target user\'s id!')
                }
                else if (g_member === undefined)
                {
                    message.reply('this user does not exist!')
                }
                else if (/^\s*$/.test(log_type) == true)
                {
                    message.reply('please supply a log type!')
                }
                else if (check_type[0] == false)
                {
                    message.reply('please supply a valid log type!')
                }
                else if (item_id < 0)
                {
                    message.reply('please supply a valid item for removal!')
                }
                else
                {
                    var db_type = check_type[1];

                    await Database.delete(`/${target_id}/${db_type}[${item}]`);
                    await message.reply(`deleted item ${item_id} in /${target_id}/${db_type}/`);
                }
            }

            if ((msg.startsWith(`${Config.Server.Prefix}log`)) && (this.checkPerms(message, uid) === true))
            {
                var split_msg = msg.split(' ');
                var target_id = split_msg[1];
                var g_member = this.getMember(target_id)
                var log_type = this.removeFirstTwoParams(msg);
                var check_type = this.checkLogType(log_type);
                var db_type = check_type[1];

                if (target_id === undefined)
                {
                    message.reply('please supply the target user\'s id!')
                }
                else if (g_member === undefined)
                {
                    message.reply('this user does not exist!')
                }
                else if (/^\s*$/.test(log_type) == true)
                {
                    message.reply('please supply a log type!')
                }
                else if (check_type[0] == false)
                {
                    message.reply('please supply a valid log type!')
                }
                else
                {
                    let path = `./u_logs/${target_id}`;

                    this.fs.exists(path,
                    (exists) =>
                        {
                            if (exists === false)
                            {
                                this.shell.mkdir('-p', path);
                            }

                            let stream = this.fs.createWriteStream(`${path}/${db_type}.log`);

                            try
                            {
                                var p = Database.getData(`/${target_id}/${db_type}`);
                            }
                            catch (err)
                            {
                                message.reply(err.message);
                                return;
                            }

                            if (log_type == 'li')
                            {
                                for (let i = 0; i < p.length; i++)
                                {
                                    let obj = p[i];
                                    let inc = i;
                                    if (obj.content != undefined)
                                    {
                                        stream.write(`|${inc}| - |${obj.content}| - |${obj.detected_links}| \n\n`, 'utf8');
                                    }
                                }
                            }

                            if (log_type == 'pw')
                            {
                                for (let i = 0; i < p.length; i++)
                                {
                                    let obj = p[i];
                                    let inc = i;
                                    if (obj.content != undefined)
                                    {
                                        stream.write(`|${inc}| - |${obj.content}| - |${obj.detected_word}| \n\n`, 'utf8');
                                    }
                                }
                            }

                            if ([ 'w', 'k', 'b' ].includes(log_type) === true)
                            {
                                for (let i = 0; i < p.length; i++)
                                {
                                    let obj = p[i];
                                    let inc = i;
                                    console.log(obj);
                                    if (obj.reason != undefined)
                                    {
                                        stream.write(`|${inc}| - |${obj.reason}| - |${obj.invoker}:${obj.invoker_id}| \n\n`, 'utf8');
                                    }
                                }
                            }

                            if (log_type == 'n')
                            {
                                for (let i = 0; i < p.length; i++)
                                {
                                    let obj = p[i];
                                    let inc = i;
                                    if (obj.content != undefined)
                                    {
                                        stream.write(`|${inc}| - |${obj.content}| - |${obj.invoker}:${obj.invoker_id}| \n\n`, 'utf8');
                                    }
                                }
                            }

                            stream.on('finish',
                            () =>
                                {
                                    let args =
                                    {
                                        data: {
                                            'key': Config.Crypto.Key,
                                            'uid': target_id,
                                            'dbtype': db_type
                                        },

                                        headers:
                                        {
                                            'Content-Type': 'application/json'
                                        }
                                    }

                                    this.rest_client.methods.post(args,
                                        (data, response) =>
                                            {
                                                let data_key = data.toString('utf8');
                                                let url = `${Config.WebServer.Protocol}://${Config.WebServer.Link}/logs/${data_key}`;
                                                this.sendChannelMessage(url, Config.Server.Channels.Moderation);
                                            }
                                    );

                                    //let file = new Discord.Attachment(`${path}/${db_type}.log`, `${target_id}_${db_type}.log`)
                                    //this.sendChannelMessage(file, Config.Server.Channels.Moderation);
                                }
                            );

                            stream.end();
                        }
                    );
                }
            }

            if ((msg.startsWith(`${Config.Server.Prefix}help`)) && (this.checkPerms(message, uid) === true))
            {
                const embed = new Discord.RichEmbed()
                  .setDescription('**Commands**\n')

                  .setColor('#FF0000')
                  .setFooter("© Corporate Clash 2017-2018")

                  .setTimestamp()

                  .addField('**Mod Types**', `\n- 1 (rule)\n - 2 (other reason)\n`, true)
                  .addField('**Log Types**', `\n- li (link infractions)\n - pw (profanity warnings)\n - w (mod warnings)\n - n (mod notes)\n - k (kicks)\n - b (bans)\n`, true)
                  .addField('**Limit Types**', `\n- a (#${Config.Server.Channels.Art})\n - s (#${Config.Server.Channels.Suggestions})\n - hq (#${Config.Server.Channels.ToonHQ})\n - m (mute)`, true)

                  .addField('**Warn User**', '```' + `${Config.Server.Prefix}warn <user's id> <type> <reason>` + '```', true)
                  .addField('**Kick User**', '```' + `${Config.Server.Prefix}kick <user's id> <type> <reason>` + '```', true)
                  .addField('**Ban User**', '```' + `${Config.Server.Prefix}ban <user's id> <#> <type> <reason>` + '```', true)
                  .addField('**Limit User**', '```' + `${Config.Server.Prefix}limit <user's id> <limit type> <reason>` + '```', true)
                  .addField('**Add Note**', '```' + `${Config.Server.Prefix}note <user's id> <note>` + '```', true)

                  .addField('**User Information**', '```' + `${Config.Server.Prefix}user <user's id>` + '```', true)
                  .addField('**User Log**', '```' + `${Config.Server.Prefix}log <user's id> <type>` + '```', true)
                  .addField('**Remove Log-Item**', '```' + `${Config.Server.Prefix}remove <user's id> <type> <item id>` + '```', true)

                this.sendChannelMessage(embed, Config.Server.Channels.Moderation);
            }

            if ((msg.startsWith(`${Config.Server.Prefix}limit`)) && (this.checkPerms(message, uid) === true))
            {
                var split_msg = msg.split(' ');
                var target_id = split_msg[1];
                var g_member = this.getMember(target_id)
                var limit_type = this.removeFirstTwoParams(msg);
                    limit_type = limit_type.split(' ')[0];
                var check_type = this.checkLimitType(limit_type);
                var reason = this.removeFirstThreeParams(msg);

                if (target_id === undefined)
                {
                    message.reply('please supply the target user\'s id!')
                }
                else if (g_member === undefined)
                {
                    message.reply('this user does not exist!')
                }
                else if (/^\s*$/.test(limit_type) == true)
                {
                    message.reply('please supply a limit type!')
                }
                else if (check_type[0] == false)
                {
                    message.reply('please supply a valid limit type!')
                }
                else if (/^\s*$/.test(reason) == true)
                {
                    message.reply('please supply a valid reason!')
                }
                else
                {
                    var role_type = check_type[1];
                    var roles = this.parent.bot.guilds.first().roles.array();
                    var role = roles.find(r => r.name === check_type[1]);
                    var has_role = g_member.roles.find(r => r.name === check_type[1]);
                    var type = 0;

                    if (limit_type == 'a')
                    {
                        if (has_role == null)
                        {
                            g_member.addRole(role, [reason]);
                            message.reply(`user has been art limited because: ${reason}`);
                            type = 1;
                        }
                        else
                        {
                            g_member.removeRole(role, [reason]);
                            message.reply(`user has been art un-limited because: ${reason}`);
                        }
                    }

                    if (limit_type == 's')
                    {
                        if (has_role == null)
                        {
                            g_member.addRole(role, [reason]);
                            message.reply(`user has been suggestion limited because: ${reason}`);
                            type = 1;
                        }
                        else
                        {
                            g_member.removeRole(role, [reason])
                            message.reply(`user has been suggestion un-limited because: ${reason}`);
                        }
                    }

                    if (limit_type == 'm')
                    {
                        if (has_role == null)
                        {
                            g_member.addRole(role, [reason]);
                            message.reply(`user has been muted because: ${reason}`);
                            type = 1;
                        }
                        else
                        {
                            g_member.removeRole(role, [reason])
                            message.reply(`user has been unmuted because: ${reason}`);
                        }
                    }

                    if (limit_type == 'hq')
                    {
                        if (has_role == null)
                        {
                            g_member.addRole(role, [reason]);
                            message.reply(`user has been hq limited because: ${reason}`);
                            type = 1;
                        }
                        else
                        {
                            g_member.removeRole(role, [reason])

                            message.reply(`user has been hq un-limited because: ${reason}`);
                        }
                    }

                    if (type == 1)
                    {
                        const embed = new Discord.RichEmbed()
                          .setDescription('**You\'ve been give restricted in the Corporate Clash discord for violation of our terms.**\n')
                          .setAuthor(g_member.user.username, await this.getAvatar(target_id))

                          .setColor('#FF0000')
                          .setFooter("© Corporate Clash 2017-2018")

                          .setTimestamp()
                          .addField('**Role**', '```' + role.name + '```', true)
                          .addField('**Reason**', '```' + reason + '```', true)

                      try
                      {
                          g_member.user.send(
                              {
                                  embed
                              }
                          )
                      }
                      catch(err)
                      {
                          message.reply(err.message);
                      }
                    }
                    else
                    {
                        const embed = new Discord.RichEmbed()
                          .setDescription('**You\'re restriction from the Corporate Clash discord has been lifted.**\n')
                          .setAuthor(g_member.user.username, await this.getAvatar(target_id))

                          .setColor('#FF0000')
                          .setFooter("© Corporate Clash 2017-2018")

                          .setTimestamp()

                      try
                      {
                          g_member.user.send(
                              {
                                  embed
                              }
                          )
                      }
                      catch(err)
                      {
                          message.reply(err.message);
                      }
                    }
                }
            }

            if ((msg.startsWith(`${Config.Server.Prefix}warn`)) && (this.checkPerms(message, uid) === true))
            {
                var split_msg = msg.split(' ');
                var target_id = split_msg[1];
                var g_member = this.getMember(target_id)
                var type = this.checkType(split_msg[2]);
                var reason = this.removeFirstThreeParams(msg);

                if (target_id === undefined)
                {
                    message.reply('please supply the target user\'s id!')
                }
                else if (g_member === undefined)
                {
                    message.reply('this user does not exist!')
                }
                else if (type === undefined)
                {
                    message.reply('please supply a type warning!')
                }
                else if (type[0] === false)
                {
                    message.reply('please supply a valid type of warning!')
                }
                else if (/^\s*$/.test(reason) == true)
                {
                    message.reply('please supply a valid reason!')
                }
                else
                {
                    var user = g_member.user;

                    if (type[1] == 1)
                    {
                        var rule = parseInt(reason)
                        reason = Config.Server.Rules[rule - 1];

                        if (reason === undefined)
                        {
                            message.reply('please supply a valid reason!')
                            return;
                        }
                        else
                        {
                            Database.push(`/${target_id}/user_warnings[]/`, {
                                reason: `Rule ${rule}`,
                                invoker: `${message.author.username}`,
                                invoker_id: `${message.author.id}`
                            }, true);

                            const embed = new Discord.RichEmbed()
                              .setDescription('**You\'ve been warned in the Corporate Clash discord for violation of our terms.**\n')
                              .setAuthor(user.username, await this.getAvatar(target_id))

                              .setColor('#FF0000')
                              .setFooter("© Corporate Clash 2017-2018")

                              .setTimestamp()
                              .addField('**Reason**', `Rule ${rule}`, true)
                              .addField('**Moderation Warnings**', this.parent.stats_hndler.getModPoints(target_id), true)
                              .addField('**Please Read**', '```' + reason + '```', true)

                          try
                          {
                              user.send(
                                  {
                                      embed
                                  }
                              )

                              message.reply(`I've warned ${user.username} for breaking rule ${rule}`)
                          }
                          catch(err)
                          {
                              message.reply(err.message);
                          }
                        }
                    }
                    else
                    {
                        Database.push(`/${target_id}/user_warnings[]/`, {
                            reason: `${reason}`,
                            invoker: `${message.author.username}`,
                            invoker_id: `${message.author.id}`
                        }, true);

                        const embed = new Discord.RichEmbed()
                          .setDescription('**You\'ve been warned in the Corporate Clash discord for violation of our terms.**\n')
                          .setAuthor(user.username, await this.getAvatar(target_id))

                          .setColor('#FF0000')
                          .setFooter("© Corporate Clash 2017-2018")

                          .setTimestamp()
                          .addField('**Moderation Warnings**', this.parent.stats_hndler.getModPoints(target_id), true)
                          .addField('**Reason**', '```' + reason + '```', true)
                      try
                      {
                          user.send(
                              {
                                  embed
                              }
                          )

                          message.reply(`I've warned ${user.username} for: ${reason}`)
                      }
                      catch(err)
                      {
                          message.reply(err.message);
                      }
                    }
                }
            }
            if ((msg.startsWith(`${Config.Server.Prefix}warn`)) && (this.checkPerms(message, uid) === false))
            {
                message.reply('sorry but you don\'t have the proper permissions to execute this command!')
            }

            if ((msg.startsWith(`${Config.Server.Prefix}kick`)) && (this.checkPerms(message, uid) === true))
            {
                var split_msg = msg.split(' ');
                var target_id = split_msg[1];
                var g_member = this.getMember(target_id)
                var type = this.checkType(split_msg[2]);
                var reason = this.removeFirstThreeParams(msg);

                if (target_id === undefined)
                {
                    message.reply('please supply the target user\'s id!')
                }
                else if (g_member === undefined)
                {
                    message.reply('this user does not exist!')
                }
                else if (type === undefined)
                {
                    message.reply('please supply a type kick!')
                }
                else if (type[0] === false)
                {
                    message.reply('please supply a valid type of kick!')
                }
                else if (/^\s*$/.test(reason) == true)
                {
                    message.reply('please supply a valid reason!')
                }
                else
                {
                    var user = g_member.user;

                    if (type[1] == 1)
                    {
                        var rule = parseInt(reason)
                        reason = Config.Server.Rules[rule - 1];

                        if (reason === undefined)
                        {
                            message.reply('please supply a valid reason!')
                            return;
                        }
                        else
                        {
                            Database.push(`/${target_id}/user_kicks[]/`, {
                                reason: `Rule ${rule}`,
                                invoker: `${message.author.username}`,
                                invoker_id: `${message.author.id}`
                            }, true);

                            const embed = new Discord.RichEmbed()
                              .setDescription('**You\'ve been kicked from the Corporate Clash discord for violation of our terms.**\n')
                              .setAuthor(user.username, await this.getAvatar(target_id))

                              .setColor('#FF0000')
                              .setFooter("© Corporate Clash 2017-2018")

                              .setTimestamp()
                              .addField('**Reason**', `Rule ${rule}`, true)
                              .addField('**Kick Points**', this.parent.stats_hndler.getKickPoints(target_id), true)
                              .addField('**Please Read**', '```' + reason + '```', true)


                            try
                            {
                                user.send(
                                    {
                                        embed
                                    }
                                )

                                g_member.kick()
                            }
                            catch(err)
                            {
                                g_member.kick()
                            }

                            message.reply(`I've kicked ${user.username} for breaking rule ${rule}`)
                        }
                    }
                    else
                    {
                        Database.push(`/${target_id}/user_kicks[]/`, {
                            reason: `${reason}`,
                            invoker: `${message.author.username}`,
                            invoker_id: `${message.author.id}`
                        }, true);

                        const embed = new Discord.RichEmbed()
                          .setDescription('**You\'ve been kicked from the Corporate Clash discord for violation of our terms.**\n')
                          .setAuthor(user.username, await this.getAvatar(target_id))

                          .setColor('#FF0000')
                          .setFooter("© Corporate Clash 2017-2018")

                          .setTimestamp()
                          .addField('**Kick Points**', this.parent.stats_hndler.getKickPoints(target_id), true)
                          .addField('**Reason**', '```' + reason + '```', true)

                      try
                      {
                          user.send(
                              {
                                  embed
                              }
                          )

                          g_member.kick()
                      }
                      catch(err)
                      {
                          g_member.kick()
                      }

                        message.reply(`I've kicked ${user.username} with the reason: ${reason}`)
                    }
                }
            }
            if ((msg.startsWith(`${Config.Server.Prefix}kick`)) && (this.checkPerms(message, uid) === false))
            {
                message.reply('sorry but you don\'t have the proper permissions to execute this command!')
            }

            if ((msg.startsWith(`${Config.Server.Prefix}ban`)) && (this.checkPerms(message, uid) === true))
            {
                var split_msg = msg.split(' ');
                var target_id = split_msg[1];
                var d_messages = parseInt(split_msg[2]);
                var g_member = this.getMember(target_id)
                var type = this.checkType(split_msg[3]);
                var reason = this.removeFirstFourParams(msg);


                if (d_messages === undefined)
                {
                    message.reply('please supply the # of days of messages to be removed!')
                }
                else if (target_id === undefined)
                {
                    message.reply('please supply the target user\'s id!')
                }
                else if (g_member === undefined)
                {
                    message.reply('this user does not exist!')
                }
                else if (type === undefined)
                {
                    message.reply('please supply a type ban!')
                }
                else if (type[0] === false)
                {
                    message.reply('please supply a valid type of ban!')
                }
                else if (/^\s*$/.test(reason) == true)
                {
                    message.reply('please supply a valid reason!')
                }
                else
                {
                    var user = g_member.user;

                    if (type[1] == 1)
                    {
                        var rule = parseInt(reason)
                        reason = Config.Server.Rules[rule - 1];

                        if (reason === undefined)
                        {
                            message.reply('please supply a valid reason!')
                            return;
                        }
                        else
                        {
                            Database.push(`/${target_id}/user_bans[]/`, {
                                reason: `Rule ${rule}`,
                                invoker: `${message.author.username}`,
                                invoker_id: `${message.author.id}`
                            }, true);

                            const embed = new Discord.RichEmbed()
                              .setDescription('**You\'ve been kicked from the Corporate Clash discord for repeated violations of our terms.**\n')
                              .setAuthor(user.username, await this.getAvatar(target_id))

                              .setColor('#FF0000')
                              .setFooter("© Corporate Clash 2017-2018")

                              .setTimestamp()
                              .addField('**Reason**', `Rule ${rule}`, true)
                              .addField('**Ban Points**', this.parent.stats_hndler.getBanPoints(target_id), true)
                              .addField('**Please Read**', '```' + reason + '```', true)


                            try
                            {
                                user.send(
                                    {
                                        embed
                                    }
                                )

                                g_member.ban({ 'days': d_messages, 'reason': `Rule ${rule}` })
                            }
                            catch(err)
                            {
                                g_member.ban({ 'days': d_messages, 'reason': `Rule ${rule}` })
                            }

                            message.reply(`I've banned ${user.username} for breaking rule ${rule} and ${d_messages} days of his messages have been removed.`)
                        }
                    }
                    else
                    {
                        Database.push(`/${target_id}/user_bans[]/`, {
                            reason: `${reason}`,
                            invoker: `${message.author.username}`,
                            invoker_id: `${message.author.id}`
                        }, true);

                        const embed = new Discord.RichEmbed()
                          .setDescription('**You\'ve been banned from the Corporate Clash discord for repeated violations of our terms.**\n')
                          .setAuthor(user.username, await this.getAvatar(target_id))

                          .setColor('#FF0000')
                          .setFooter("© Corporate Clash 2017-2018")

                          .setTimestamp()
                          .addField('**Ban Points**', this.parent.stats_hndler.getBanPoints(target_id), true)
                          .addField('**Reason**', '```' + reason + '```', true)

                      try
                      {
                          user.send(
                              {
                                  embed
                              }
                          )

                          g_member.ban({ 'days': d_messages, 'reason': reason })
                      }
                      catch(err)
                      {
                          g_member.ban({ 'days': d_messages, 'reason': reason })
                      }

                        message.reply(`I've banned ${user.username} with the reason: ${reason} and ${d_messages} days of his messages have been removed.`)
                    }
                }
            }
            if ((msg.startsWith(`${Config.Server.Prefix}ban`)) && (this.checkPerms(message, uid) === false))
            {
                message.reply('sorry but you don\'t have the proper permissions to execute this command!')
            }

            if ((msg.startsWith(`${Config.Server.Prefix}note`)) && (this.checkPerms(message, uid) === true))
            {
                var split_msg = msg.split(' ');
                var target_id = split_msg[1];
                var g_member = this.getMember(target_id)
                var reason = this.removeFirstTwoParams(msg);

                if (target_id === undefined)
                {
                    message.reply('please supply the target user\'s id!')
                }
                else if (g_member === undefined)
                {
                    message.reply('this user does not exist!')
                }
                else if (/^\s*$/.test(reason) == true)
                {
                    message.reply('please supply a valid note!')
                }
                else
                {
                    var user = g_member.user;

                    Database.push(`/${target_id}/user_notes[]/`, {
                        content: `${reason}`,
                        invoker: `${message.author.username}`,
                        invoker_id: `${message.author.id}`
                    }, true);

                    message.reply(`I've add that note to ${user.username}'s account.`)

                }
            }
            if ((msg.startsWith(`${Config.Server.Prefix}note`)) && (this.checkPerms(message, uid) === false))
            {
                message.reply('sorry but you don\'t have the proper permissions to execute this command!')
            }
        }
    }

    handleReaction(reaction, user, type)
    {
        if (user.bot == true)
        {
            return;
        }

        var message = reaction.message;
        var emoji = reaction.emoji.name;
        var auth_id = message.author.id;
        var channel = message.channel.name;
        var channelId = message.channel.id;
        var suggestion_count = this.parent.stats_hndler.getSuggestionStats(auth_id);
        var uv = parseInt(suggestion_count.uv);
        var dv = parseInt(suggestion_count.dv);

        if (channelId === Config.Server.Channels.Suggestions)
        {
            if (emoji == "✅")
            {
                if (type === 'add')
                {
                    Database.push(`/${auth_id}/suggestion_count[0]`, {
                        "uv": (uv + 1),
                        "dv": (dv)
                    }, true);
                }
                else if (type === 'remove')
                {
                    Database.push(`/${auth_id}/suggestion_count[0]`, {
                        "uv": (uv - 1),
                        "dv": (dv)
                    }, true);
                }
            }
            else if (emoji == "❌")
            {
                if (type === 'add')
                {
                    Database.push(`/${auth_id}/suggestion_count[0]`, {
                        "uv": (uv),
                        "dv": (dv + 1)
                    }, true);
                }
                else if (type === 'remove')
                {
                    Database.push(`/${auth_id}/suggestion_count[0]`, {
                        "uv": (uv),
                        "dv": (dv - 1)
                    }, true);
                }
            }
        }
    }

    checkPerms(message, uid)
    {
        var roles = this.getMember(uid).roles;
        var role = roles.find(
            (r) =>
            {
                return r.name === Config.Roles.Staff;
            }
        );

        if (role !== null)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    checkRole(uid, role_name)
    {
        var roles = this.parent.bot.guilds.first().members.get(uid).roles.array();
        var role = roles.find(
            (r) =>
            {
                return r.name === role_name;
            }
        );

        if (role)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    async sendChannelMessage(msg, channel)
    {
        var channels = this.parent.bot.channels.array();
        var channel = channels.find(
            (c) =>
            {
                return c.id === channel;
            }
        );

        channel.send(msg);
    }

    splitStr (str)
    {
        return str.match(/[^]{1,1024}/g);
    }

    checkLink(msg, channelId)
    {

        /*if (/\s/.test(msg))
        {
            msg = msg.split(' ').join('');
        }*/

        var find_link = this.linkify.find(msg);
        var link_len = find_link.length;

        if (link_len > 0)
        {
            if (channelId === Config.Server.Channels.Streams)
            {

                for (var i = 0; i < Config.Server.Links.Streams.length; i++)
                {
                  var link_2_check = Config.Server.Links.Streams[i];
                  var regex = new RegExp(link_2_check, 'gi');
                  var check = msg.match(regex);
                  if (check !== null)
                  {
                      return [false, ''];
                  }
                }

                return [true, find_link[0].value];
            }
            else if (channelId === Config.Server.Channels.ToonHQ)
            {

                for (var i = 0; i < Config.Server.Links.ToonHQ.length; i++)
                {
                  var link_2_check = Config.Server.Links.ToonHQ[i];
                  var regex = new RegExp(link_2_check, 'gi');
                  var check = msg.match(regex);
                  if (check !== null)
                  {
                      return [false, ''];
                  }
                }

                return [true, find_link[0].value];
            }
            else if (channelId !== Config.Server.Channels.ToonHQ)
            {
                for (var i = 0; i < Config.Server.Links.Default.length; i++)
                {
                  var link_2_check = Config.Server.Links.Default[i];
                  var regex = new RegExp(link_2_check, 'gi');
                  var check = msg.match(regex);
                  if (check !== null)
                  {
                      return [false, ''];
                  }
                }

                return [true, find_link[0].value];
            }
            else
            {
                return [true, find_link[0].value];
            }
        }
        else
        {
            return [false, ''];
        }

    }

    checkProfanity(msg)
    {
        this.check = 0;
        this.d_word = '';

        var o_msg = msg;

        var regex=/^[0-9A-Za-z]+$/;

        if (/\s/.test(msg))
        {
            msg = msg.split(' ').join('');
        }

        if (!regex.test(msg))
        {
            msg = msg.replace(/[^0-9a-z]/gi, '');
        }

        var check_1 = this.profanity.check(msg);

        if (check_1.length <= 0)
        {
            check_1 = this.profanity.check(o_msg);

            if (check_1.length <= 0)
            {
                var od_msg = o_msg.split(' ');
                for (var i = 0; i < od_msg.length; i++)
                {
                    var n_msg = od_msg[i];

                    if (!regex.test(n_msg))
                    {
                        n_msg = n_msg.replace(/[^0-9a-z]/gi, '');
                    }

                    var check_2 = this.profanity.check(n_msg);

                    if (check_2.length > 0)
                    {
                        this.check = 1;
                        this.d_word = check_2[0];
                    }
                    else
                    {
                        this.check = 0;
                        this.d_word = check_2[0]
                    }
                }
            }
            else
            {
                this.check = 1;
                this.d_word = check_1[0];
            }
        }
        else if (check_1.length > 0)
        {
            this.check = 1;
            this.d_word = check_1[0];
        }

        return [this.check, this.d_word];
    }

    checkUnique(msg)
    {
        for (var i = 0; i < msg.length; i++)
        {
            var char = msg[i];

            for (var j = i; j <= msg.length - 1; j++)
            {
                if (char == msg[j])
                {
                    return false;
                }
            }
        }

        return true;
    }

    async getAVName(id)
    {
        let user = await this.parent.bot.fetchUser(id).catch(()=>null);

        if (user.discriminator !== null)
        {
            return user.username;
        }
    }

    getMember(id)
    {
        let users = this.parent.bot.users.array();
        let user = users.find(
            (u) =>
            {
                return u.id === id;
            }
        );

        var first_guild = this.parent.bot.guilds.first();
        var member = first_guild.member(user);

        return member;
    }

    async getUser(id)
    {
        let user = await this.parent.bot.fetchUser(id).catch(()=>null);

        if (user.discriminator !== null)
        {
            return user;
        }
    }

    async getAvatar(id)
    {
        let user = await this.parent.bot.fetchUser(id).catch(()=>null);

        if (user.discriminator !== null)
        {
            return user.avatarURL;
        }
    }

    checkLimitType(type)
    {
        switch(type)
        {
            case 's':
                return [true, Config.Roles.SuggestionLimit];
                break;
            case 'm':
                return [true, Config.Roles.Mute];
                break;
            case 'a':
                return [true, Config.Roles.ArtLimit];
                break;
            case 'hq':
                return [true, Config.Roles.HQLimit];
                break;
            default:
                return [false, ''];
                break;
        }
    }

    checkLogType(type)
    {
        switch(type)
        {
            case 'li':
                return [true, 'link_infractions'];
                break;
            case 'w':
                return [true, 'user_warnings'];
                break;
            case 'k':
                return [true, 'user_kicks'];
                break;
            case 'b':
                return [true, 'user_bans'];
                break;
            case 'pw':
                return [true, 'profanity_warnings'];
                break;
            case 'ub':
                return [true, 'user_unbans'];
                break;
            case 'n':
                return [true, 'user_notes'];
                break;
            default:
                return [false, ''];
                break;
        }
    }

    checkType(type)
    {
        type = parseInt(type)

        if (type == 1)
        {
            return [true, type];
        }
        else if (type == 2)
        {
            return [true, type];
        }
        else
        {
            return [false, type];
        }
    }

    removeFirstTwoParams(msg)
    {
        var split_msg = msg.split(' ');
        split_msg.shift()
        split_msg.shift()
        var join_msg = split_msg.join(' ')
        return join_msg;
    }

    removeFirstThreeParams(msg)
    {
        var split_msg = msg.split(' ');
        split_msg.shift()
        split_msg.shift()
        split_msg.shift()
        var join_msg = split_msg.join(' ')
        return join_msg;
    }

    removeFirstFourParams(msg)
    {
        var split_msg = msg.split(' ');
        split_msg.shift()
        split_msg.shift()
        split_msg.shift()
        split_msg.shift()
        var join_msg = split_msg.join(' ')
        return join_msg;
    }

    replace(str, obj)
    {
        for (var i in obj)
        {
            if (str.includes(i))
            {
                str = str.replace(new RegExp(i, 'g'), obj[i])
            }
        }

        return str;
    }

}


module.exports = MessageHandler;
