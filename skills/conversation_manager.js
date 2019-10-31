resp = require("../response/response.js");
request = require("request");
sync = require('sync-request');

var UserController = require("../utils/usercontroller.js")
const CONVERSATION_MANAGER_ENDPOINT = "https://nameless-basin-64349.herokuapp.com/api/LT-conversation-manager"
const RATING_CONVERSATION_ENDPOINT = "https://nameless-basin-64349.herokuapp.com/api/LT-save-rating-conversation"
const IS_QUESTION_ENDPOINT = "https://nameless-basin-64349.herokuapp.com/api/LT-conversation-manager/classify-message"
const SAVE_MESSAGE_TO_DB = "https://nameless-basin-64349.herokuapp.com/api/LT-conversation-manager/messages";
const ATTR_LIST = ["interior_floor", "interior_room", "legal", "orientation", "position", "realestate_type", "surrounding_characteristics", "surrounding_name", "surrounding", "transaction_type"];
const ENTITY_LIST = ["area", "location", "potential", "price", "addr_district"]
const LOCATION_ATTR_LIST = ["addr_city", "addr_street", "addr_ward", "addr_district"]
const AGREE_THRESHOLD = 0.5;
const NUM_ASK_THRESHOLD = 1;
const NUM_ASW_THRESHOLD = 3;
var userController = new UserController();
module.exports = function (controller) {

    var promiseBucket = {
        default: []
    }

    var userMessageCount = {
    }
    // var isGetInfor = false;

    var isRating = {};
    var star = {};
    var appropriate = {}; // "khong_phu_hop", "hoi_thieu", "phu_hop", "hoi_du",
    var catched_intents = {}; //arr type
    var edited_intents = {}; // arr type
    var conversation = {}; // arr type
    function isEmpty(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key))
                return false;
        }
        return true;
    }

    function conductOnboarding(bot, message) {

        bot.startConversation(message, function (err, convo) {
            var id = message.user
            // console.log("id "+ id);

            // document.getElementById("user-id").innerHTML = id;
            // if (id) {
            //     var delete_body = sync("DELETE", CONVERSATION_MANAGER_ENDPOINT + "?graph_id=" + id);
            //     console.log("DELETE GRAPH CODE:" + delete_body.statusCode);
            // }
            convo.say({
                text: resp.hello,
            });
            userMessageCount[id] = 0;
        });
    }

    function continueConversation(bot, message) {

        var id = message.user;
        // console.log("id "+ id);
        

        var user = userController.searchSession(id);
        if (user != null) {
            console.log("welcome back-------------------------" + id);
            
            // refresh at getIntent
            if (!user.getIntent) {
                bot.reply(message, {
                    text: resp.hello
                });
                // refresh at getInfor
            } else if (!user.getInfor) {
                bot.reply(message, {
                    text: resp.ask_infor[Math.floor(Math.random() * resp.ask_infor.length)]
                });
                // refresh at confirm infor
            } else {
                var success = userController.deleteSession(id);
                if (!success) {
                    console.log("Error in delete function");
                } else {
                    console.log("Delete success");
                }
                bot.reply(message, {
                    text: resp.hello
                });

            }

        } else {
            bot.startConversation(message, function (err, convo) {
                // var id = message.user
                // console.log(id)
                convo.say({
                    text: resp.hello,
                });
            });
        }
    }
    function restartConversation(bot, message) {
        var id = message.user
        if (isRating[id] && message.save) {
            console.log("CALL SAVE API HERE")
            body = {
                star: star[id],
                appropriate: appropriate[id],
                catched_intents: catched_intents[id],
                edited_intents: edited_intents[id],
                conversation: conversation[id]
            }
            console.log(JSON.stringify(body))
            request.post(RATING_CONVERSATION_ENDPOINT, { json: body }, (err, resp, data) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log(data);
                }
            })
        }
        isRating[id] = false;
        bot.reply(message, { graph: {}, text: resp.thank });
        var success = userController.deleteSession(id);
        if (!success) {
            console.log("Error in delete function");
        } else {
            console.log("Delete success");
        }

        console.log("id "+ id);
        if (id) {
            conversation[id] = [];
            var delete_body = sync("DELETE", CONVERSATION_MANAGER_ENDPOINT + "?graph_id=" + id);
            console.log("DELETE GRAPH CODE:" + delete_body.statusCode);
        }
        setTimeout(() => {
            bot.reply(message, resp.hello)
            userMessageCount[id] = 0;
            userController.deleteSession(id);
        }, 1000)

    }

    function saveToDatabase(user, bot, message) {
        temp = {
            message: user.data.message,
            intent: user.data.intent,
            is_correct: user.data.is_correct,
            user_id: message.user
        }
        console.log(temp);
        request.post(CONVERSATION_MANAGER_ENDPOINT + "/messages", {
            json: {
                message: user.data.message,
                intent: user.data.intent,
                is_correct: user.data.is_correct,
                user_id: message.user
            }

        }, (error, res, body) => {
            if (error) {
                console.log(error);
                conversation[message.user].push("bot: " + resp.err);
                bot.reply(message, {
                    graph: {},
                    text: "có lỗi xảy ra khi lưu vào database"
                })
                return
            }

            console.log(body);

            bot.reply(message, {
                text: resp.thank,
                force_result: [
                    {
                        title: 'Bắt đầu hội thoại mới',
                        payload: {
                            'restart_conversation': true
                        }
                    }
                ]
            });
            var success = userController.deleteSession(message.user);
            if (!success) {
                console.log("Error in delete function");
            } else {
                console.log("Delete success");
            }
            return;

        });
    }
    function saveMessageToDatabase(user, bot, message) {
        temp = {
            message: user.data.message,
            intent: user.data.intent,
            user_id: message.user,
            is_correct: false
        }
        console.log(temp);
        request.post(SAVE_MESSAGE_TO_DB, {
            json: temp

        }, (error, res, body) => {
            if (error) {
                console.log(error);
                conversation[message.user].push("bot: " + resp.err);
                bot.reply(message, {
                    graph: {},
                    text: "có lỗi xảy ra khi lưu vào database"
                })
                return
            }

            console.log(body);

            return;

        });
    }
    function callConversationManager(bot, message) {

        var isGetInfor = false;

        var id = message.user;
        var raw_mesg = message.text
        var showCustomButton = false;
        var force_show = false;
        var remove_more = false;
        var filter_attr = false;
        var filter_all = false;
        var isGetIntent = true;

        var user = userController.searchSession(id);
        if (user == null) {
            user = userController.insertSession(id);
        }
        console.log(message);
        if (raw_mesg) {
            if (conversation[message.user]) {
                conversation[message.user].push("user: " + raw_mesg);
            } else {
                conversation[message.user] = ["user: " + raw_mesg];
            }
        }
        // if (message.rating_prop) {
        //     console.log(message.rating_prop)
        //     if (message.rating_prop.star) star[message.user] = message.rating_prop.star;
        //     if (message.rating_prop.appropriate) appropriate[message.user] = message.rating_prop.appropriate;
        //     if (message.rating_prop.catched_intents) edited_intents[message.user] = message.rating_prop.catched_intents;
        //     return;
        // }
        // if (message.continue) {
        //     conversation[message.user].push("bot: "+ resp.whatyourattr );
        //     bot.reply(message, resp.whatyourattr);
        //     return;
        // }
        // if (message.start_rating) {
        //     isRating[message.user] = true;
        //     star[message.user] = -1;
        //     appropriate[message.user] = "phu_hop"; // "khong_phu_hop", "hoi_thieu", "phu_hop", "hoi_du"
        //     catched_intents[message.user] = message.catched_intents;
        //     edited_intents[message.user] = message.catched_intents;
        //     conversation[message.user].push("bot: "+  resp.start_rating );
        //     bot.reply(message, {
        //         text: resp.start_rating,
        //         start_rating: true,
        //         catched_intents: catched_intents[message.user],
        //         force_result: [
        //             {
        //                 title: 'Save',
        //                 payload: {
        //                     'quit': true,
        //                     'save': true
        //                 }
        //             },
        //             {
        //                 title: 'Cancel',
        //                 payload: {
        //                     'quit': true,
        //                     'save': false
        //                 },
        //             },
        //         ]
        //     });
        //     return;
        // }
        if (message.quit) {
            restartConversation(bot, message);
            return;
        }

        // if (message.correct_intent){
        //     bot.reply(message, {
        //         text:resp.correct_intent,

        //     });
        //     user.data.is_correct = true;
        //     saveToDatabase(user, bot, message);
        //     return;
        //     // var success = userController.deleteSession(id);
        //     // if (!success){
        //     //     console.log("Error in delete function");
        //     // } else {
        //     //     console.log("Delete success");
        //     // }
        //     // return;
        // }
        // if (message.wrong_intent){
        //     user.data.is_correct = false;
        //     bot.reply(message, {
        //         text: resp.wrong_intent,
        //         force_result: [
        //             {
        //                 title: 'activity',
        //                 payload: {
        //                     'choose_intent': "activity"
        //                 }
        //             },
        //             {
        //                 title: 'joiner',
        //                 payload: {
        //                     'choose_intent': "joiner"
        //                 }
        //             },
        //             {
        //                 title: 'work',
        //                 payload: {
        //                     'choose_intent': "work"
        //                 }
        //             },
        //             {
        //                 title: 'register',
        //                 payload: {
        //                     'choose_intent': "register"
        //                 }
        //             },
        //             {
        //                 title: 'contact',
        //                 payload: {
        //                     'choose_intent': "contact"
        //                 }
        //             }
        //         ].filter((obj)=>{
        //             return (obj.title != user.data.intent);
        //         })
        //     });
        //     return;
        // }
        // if (message.choose_intent){
        //     user.data.intent = message.choose_intent;
        //     console.log("user select " + user.data.intent);
        //     saveToDatabase(user, bot, message);
        //     return;

        // }
        // if (message.resubmit_infor){
        //     userController.searchSession(id).getInfor = false;
        //     bot.reply(message, {
        //         text: resp.wrong[Math.floor(Math.random() * resp.wrong.length)]
        //     });
        //     return;
        // }

        if (message.completed) {
            bot.reply(message, {
                text: resp.goodbye[Math.floor(Math.random() * resp.goodbye.length)],
                force_result: [
                    {
                        title: 'Bắt đầu hội thoại mới',
                        payload: {
                            'restart_conversation': true
                        }
                    }
                ]
            });
            var success = userController.deleteSession(id);
            if (!success) {
                console.log("Error in delete function");
            } else {
                console.log("Delete success");
            }
            return;
        }
        if (message.restart_conversation) {
            bot.reply(message, {
                text: resp.hello
            });
            return;
        }
        if (!promiseBucket[id]) {
            promiseBucket[id] = []
        }
        var bucket = promiseBucket[id]
        var pLoading = { value: true };
        bucket.push(pLoading)

        function requestGET() {
            pLoading.value = false;
            if (bucket.every(ele => { return ele.value === false })) {
                // + "&force_get_results=true"
                var postfix_force_show = "";
                // if (force_show === true) {
                //     postfix_force_show = "&force_get_results=true"
                // }
                // if (filter_attr === true) {
                //     postfix_force_show += "&key_filter=" + message.filterAttr.key + "&value_filter=" + message.filterAttr.value
                // }
                // if (filter_all === true) {
                //     postfix_force_show += "&key_filter=all";
                // }
                console.log(postfix_force_show)
                request.get(CONVERSATION_MANAGER_ENDPOINT + "?graph_id=" + id + postfix_force_show, {}, (error, res, body) => {
                    // console.log(body)
                    if (error) {
                        conversation[message.user].push("bot: " + resp.err);
                        bot.reply(message, {
                            graph: graph,
                            text: resp.err
                        })
                        return
                    }
                    try {
                        response_body = JSON.parse(body);
                        console.log("***")
                        console.log(JSON.stringify(response_body));
                        var graph = response_body.graph;
                        // bot.reply(message, {
                        //     graph: graph
                        // })
                        console.log("***")
                        if (promiseBucket[id].every(ele => { return ele.value === false })) {
                            bucket = []
                            promiseBucket[id] = []
                            if (response_body.initial_fill == false) {
                                conversation[message.user].push("bot: " + response_body.question);
                                bot.reply(message, {
                                    text: response_body.question
                                })
                            } else
                                if (response_body.has_results === true) {
                                    // có kết quả, trả lời được rồi
                                    if (response_body.result_container.length == 0 || remove_more === true) {
                                        // nếu container không có gì hoặc người dùng muốn xóa bớt attr
                                        // show các attr đang có để xóa
                                        var list = []
                                        var mentioned_attributes = response_body.mentioned_attributes;

                                        for (var i = 0; i < mentioned_attributes.length; i++) {
                                            (function (ele) {
                                                if (ATTR_LIST.indexOf(ele) != -1 || (ele !== "addr_district" && ele !== "location" && ENTITY_LIST.indexOf(ele) != -1)) {
                                                    if (graph[ele] && graph[ele].value_raw) {
                                                        var arr = graph[ele].value_raw;
                                                        if (arr.length > 0) {
                                                            var value = arr[0]
                                                            for (var j = 1; j < arr.length; j++) {
                                                                value += ", " + arr[j]
                                                            }
                                                            list.push({ value: value, key: ele });
                                                        }
                                                    }
                                                }
                                                if (LOCATION_ATTR_LIST.indexOf(ele) != -1) {
                                                    if (graph["location"][ele] && graph["location"][ele].value_raw) {
                                                        var arr = graph["location"][ele].value_raw;
                                                        if (arr.length > 0) {
                                                            var value = arr[0]
                                                            for (var j = 1; j < arr.length; j++) {
                                                                value += ", " + arr[j]
                                                            }
                                                            list.push({ value: value, key: ele });
                                                        }
                                                    }
                                                }
                                            })(mentioned_attributes[i]);
                                        }
                                        if (list && list.length > 0) {
                                            conversation[message.user].push("bot: " + resp.cantfind);
                                            bot.reply(message, {
                                                text: resp.cantfind,
                                                attr_list: list,
                                                graph: graph,
                                            })
                                        } else {
                                            conversation[message.user].push("bot: " + resp.wetried);
                                            bot.reply(message, { graph: graph, text: resp.wetried })
                                        }

                                    } else {
                                        // for result_container != []
                                        // show kết quả 
                                        if (response_body.intent_values_container && !isEmpty(response_body.intent_values_container)) {
                                            conversation[message.user].push("bot: " + resp.showall);
                                            bot.reply(message, {
                                                text: resp.showall,
                                                intent_dict: response_body.intent_values_container,
                                                graph: graph,
                                                force_result: [
                                                    {
                                                        title: 'Được rồi, cảm ơn!',
                                                        payload: {
                                                            'start_rating': true,
                                                            'catched_intents': graph.current_intents
                                                        }
                                                    },
                                                    {
                                                        title: 'Có',
                                                        payload: {
                                                            'filter_all': true,
                                                        },
                                                    },
                                                ]
                                            })
                                        } else {
                                            console.log(response_body.result_container)
                                            conversation[message.user].push("bot: " + (response_body.intent_response ? response_body.intent_response : "Kết quả của bạn: "));
                                            conversation[message.user].push("bot: " + "Bạn có muốn thêm yêu cầu gì không?");
                                            bot.reply(message, {
                                                text: [response_body.intent_response ? response_body.intent_response : "Kết quả của bạn: ", "Bạn có muốn thêm yêu cầu gì không?"],
                                                show_results: response_body.result_container,
                                                concerned_attributes: response_body.concerned_attributes,
                                                graph: graph,
                                                force_result: [
                                                    {
                                                        title: 'Có',
                                                        payload: {
                                                            'continue': true
                                                        },
                                                    },
                                                    {
                                                        title: 'Được rồi, cảm ơn!',
                                                        payload: {
                                                            'start_rating': true,
                                                            'catched_intents': graph.current_intents
                                                        }
                                                    }
                                                ]
                                            })
                                        }
                                    }

                                } else {
                                    // chưa trả lời được do số doc còn nhiều
                                    if (showCustomButton) { // show nút bấm cho người dùng
                                        conversation[message.user].push("bot: " + response_body.question);
                                        bot.reply(message, {
                                            text: response_body.question,
                                            graph: graph,
                                            force_result: [
                                                {
                                                    title: 'Bỏ tiếp yêu cầu',
                                                    payload: {
                                                        'remove_more': true
                                                    },
                                                },
                                                {
                                                    title: 'In luôn kết quả',
                                                    payload: {
                                                        'force_show': true
                                                    }
                                                }
                                            ]
                                        })
                                    }
                                    else {
                                        // lấy câu hỏi lại rồi hỏi người dùng
                                        if (userMessageCount[id] > 3) {
                                            conversation[message.user].push("bot: " + response_body.question);
                                            bot.reply(message, {
                                                graph: graph,
                                                text: response_body.question,
                                                force_result: [
                                                    {
                                                        title: 'In luôn kết quả',
                                                        payload: {
                                                            'force_show': true
                                                        }
                                                    }
                                                ]
                                            })
                                        } else {
                                            if (userMessageCount[id]) {
                                                userMessageCount[id] += 1;
                                            } else {
                                                userMessageCount[id] = 1;
                                            }
                                            console.log("userMessageCount: ", userMessageCount[id])
                                            conversation[message.user].push("bot: " + response_body.question);
                                            bot.reply(message, {
                                                graph: graph,
                                                text: response_body.question
                                            })
                                        }
                                    }
                                }
                        }
                    } catch (e) {
                        conversation[message.user].push("bot: " + resp.err);
                        bot.reply(message, {
                            graph: graph,
                            text: resp.err
                        })
                    }
                })
            } else {
                console.log(bucket)
                console.log(JSON.stringify(promiseBucket))
            }
        }

        if (raw_mesg && raw_mesg.length > 0) {
            // console.log("say hi")
            // console.log(isGetInfor);
            // console.log(isGetIntent);
            if (raw_mesg.trim().toLowerCase() == "bye") {
                bot.reply(message, {
                    text: resp.goodbye[Math.floor(Math.random() * resp.goodbye.length)],
                    force_result: [
                        {
                            title: 'Bắt đầu hội thoại mới',
                            payload: {
                                'restart_conversation': true
                            }
                        }
                    ]
                });

                var success = userController.deleteSession(id);
                if (!success) {
                    console.log("Error in delete function");
                } else {
                    console.log("Delete success");
                }
                return;
            }

            request.post(IS_QUESTION_ENDPOINT, {
                json: {
                    message: raw_mesg
                }
            }, (error, res, body) => {
                intent = null;
                if (error) {
                    console.log(error);
                    bot.reply(message, {
                        text: resp.err
                    });
                    return;
                }

                console.log("is question: " + body.is_question);
                if (body.is_question || body.intent == "hello" 
                                    || body.intent == "yes_no"
                                    || body.intent == "dont_care"
                ) {
                    user.data.prev_bot_ask = null;

                    intent = body.intent;
                    var responseSentence;
                    switch (intent) {
                        case "activity":
                            responseSentence = resp.activity[Math.floor(Math.random() * resp.activity.length)];
                            break;
                        case "joiner":
                            responseSentence = resp.joiner[Math.floor(Math.random() * resp.joiner.length)];
                            break;
                        case "work":
                            responseSentence = resp.work[Math.floor(Math.random() * resp.work.length)];
                            break;
                        case "contact":
                            responseSentence = resp.contact[Math.floor(Math.random() * resp.contact.length)];
                            break;
                        case "register":
                            responseSentence = resp.register[Math.floor(Math.random() * resp.register.length)];
                            break;
                        case "location":
                            responseSentence = resp.location[Math.floor(Math.random() * resp.location.length)];
                            break;
                        case "time":
                            responseSentence = resp.time[Math.floor(Math.random() * resp.time.length)];
                            break;
                        case "holder":
                            responseSentence = resp.holder[Math.floor(Math.random() * resp.holder.length)];
                            break;
                        case "reward":
                            responseSentence = resp.reward[Math.floor(Math.random() * resp.reward.length)];
                            break;
                        case "yes_no":
                            responseSentence = resp.yes_no[Math.floor(Math.random() * resp.yes_no.length)];
                            break;
                        case "dont_care":
                            responseSentence = resp.dont_care[Math.floor(Math.random() * resp.dont_care.length)];
                            break;
                        case "hello":
                            responseSentence = resp.hello_again[Math.floor(Math.random() * resp.hello_again.length)];
                            break;
                        default:
                            responseSentence = resp.err
                    }
                    console.log(responseSentence);
                    bot.reply(message, { text: responseSentence });

                    user.data.asw_count++;
                    if (user.data.asw_count > NUM_ASW_THRESHOLD) {
                        bot.reply(message, {
                            text: resp.bot_wants_to_ask[Math.floor(Math.random() * resp.bot_wants_to_ask.length)]
                        });
                        user.data.asw_count = 0;
                    }



                } else {
                    // it's an answer, agree
                    if (parseFloat(Math.random()) > AGREE_THRESHOLD) {
                        bot.reply(message, {
                            text: resp.agree[Math.floor(Math.random() * resp.agree.length)]
                        });
                    } 
                    // response a message which is relevant to user's answer before
                    if (user.data.prev_bot_ask != null){
                        var responseIndex = user.data.prev_bot_ask;
                        console.log(`response to user, previous is ${resp.intent_list[responseIndex]}`);
                        var ansList = (resp.intent_question_response[responseIndex])[`${resp.intent_list[responseIndex]}`];
                        var responseSentence = ansList[Math.floor(Math.random() * ansList.length)];
                        bot.reply(message, {
                            text: responseSentence
                        });
                        user.data.prev_bot_ask = null;
                    }

                    // now ask an question for user
                    var randomIndex = Math.floor(Math.random() * resp.intent_question.length);
                    var askList = (resp.intent_question[randomIndex])[`${resp.intent_list[randomIndex]}`];
                    var question = askList[Math.floor(Math.random() * askList.length)];
                    if (user.data.ask_count > NUM_ASK_THRESHOLD) {
                        bot.reply(message, {
                            text: resp.bot_wants_to_answer[Math.floor(Math.random() * resp.bot_wants_to_answer.length)]
                        });
                        user.data.ask_count = 0;
                    } else {
                        bot.reply(message, {
                            text: question
                        });
                        user.data.ask_count++;
                        user.data.prev_bot_ask = randomIndex;
                        console.log(`save ${user.data.prev_bot_ask} - ${resp.intent_list[randomIndex]} to controller`);

                    }

                }

                user.data.message = raw_mesg;
                user.data.intent = intent;

                saveMessageToDatabase(user, bot, message);


            });

            // var user = userController.searchSession(id);

            // if (user == null){
            //     user = userController.insertSession(id);
            // }


            // if (!user.getIntent){

            //     console.log("get Intent");
            //     request.post(CONVERSATION_MANAGER_ENDPOINT, {
            //         json: {
            //             message: raw_mesg
            //         }
            //     }, (error, res, body) => {
            //         if (error) {
            //             console.log(error);
            //             conversation[message.user].push("bot: "+ resp.err );
            //             bot.reply(message, {
            //                 graph: {},
            //                 text: resp.err
            //             })
            //             return
            //         }
            //         // console.log("type: " + typeof(res.activity));
            //         var responseSentence;
            //         switch (body.message){
            //             case "activity":
            //                 responseSentence = "Bạn vừa hỏi về  \"activity\" - thông tin chung chung về toàn bộ hoạt động đúng không?";
            //                 break;
            //             case "joiner":
            //                 responseSentence = "Bạn vừa hỏi về thông tin \"joiner\" - người tham gia đúng không?";
            //                 break;
            //             case "work":
            //                 responseSentence = "Bạn vừa hỏi về  \"work\" - các công việc có trong hoạt động đúng không?";
            //                 break;
            //             case "contact":
            //                 responseSentence = "Bạn vừa hỏi về  \"contact\" - thông tin liên hệ ban tổ chức hoạt động đúng không?";
            //                 break;
            //             case "register":
            //                 responseSentence = "Bạn vừa hỏi về  \"register\" - thông tin đăng ký tham gia hoạt động đúng không?";
            //                 break;
            //             default:
            //                 responseSentence = resp.err
            //         }
            //         user.data.message = raw_mesg;
            //         user.data.intent = body.message;
            //         console.log(responseSentence);
            //         bot.reply(message, {
            //             text: responseSentence,
            //             force_result: [
            //                 {
            //                     title: 'Đúng rồi',
            //                     payload: {
            //                         'correct_intent': true
            //                     }
            //                 },
            //                 {
            //                     title: 'Sai rồi',
            //                     payload: {
            //                         'wrong_intent': true,
            //                     },
            //                 },
            //             ]

            //         });

            //         // responseSentence = resp.ask_infor[Math.floor(Math.random() * resp.ask_infor.length)];
            //         // bot.reply(message, 
            //         //     {
            //         //         text:responseSentence,
            //         //         // isGetInfor: true
            //         //     });

            //     });
            //     user.getIntent = true;
            // } else if (!user.getInfor){
            //     request.post(CONVERSATION_MANAGER_ENDPOINT + "/extract-information", {
            //         json: {
            //             message: raw_mesg
            //         }
            //     }, (error, res, body) =>{
            //         if (error){
            //             console.log(error);
            //             conversation[message.user].push("bot: "+ resp.err );
            //             bot.reply(message, {
            //                 graph: {},
            //                 text: resp.err
            //             })  
            //             return
            //         }
            //         // console.log(body);
            //         if (body.emails.length == 0 && body.names == '' && body.phones.length == 0){
            //             bot.reply(message, {
            //                 text: resp.confuse[Math.floor(Math.random() * resp.confuse.length)]
            //             });
            //             userController.searchSession(id).getInfor = false;
            //             return;
            //         } else {
            //             bot.reply(message, {
            //                     text:`${resp.get_infor_confirm[Math.floor(Math.random() * resp.get_infor_confirm.length)]}\n 
            //             emails: ${body.emails.join(',')} \n 
            //             Số điện thoại: ${body.phones.join(',')}`,
            //                     force_result: [
            //                     {
            //                         title: 'Đúng rồi',
            //                         payload: {
            //                             'completed': true
            //                         }
            //                     },
            //                     {
            //                         title: 'Sai rồi',
            //                         payload: {
            //                             'resubmit_infor': true,
            //                         },
            //                     },
            //                 ]
            //             })

            //         }
            //     });
            //     user.getInfor = true;
            //     // userController.deleteSession(id);

            // } else {

            //     var success = userController.deleteSession(id);
            //     if (!success){
            //         console.log("Error in delete function");
            //     } else {
            //         console.log("Delete success");
            //     }
            // }

            // if (isGetInfor == true){
            //     // console.log("isgetInfor");
            //     request.post(CONVERSATION_MANAGER_ENDPOINT + "/extract-information", {
            //         json: {
            //             message: raw_mesg
            //         }
            //     }, (error, res, body) =>{
            //         if (error){
            //             console.log(error);
            //             conversation[message.user].push("bot: "+ resp.err );
            //             bot.reply(message, {
            //                 graph: {},
            //                 text: resp.err
            //             })  
            //             return
            //         }
            //         // console.log(body);
            //         if (body.emails.length == 0 && body.names == '' && body.phones.length == 0){
            //             bot.reply(message, {
            //                 text: resp.confuse[Math.floor(Math.random() * resp.confuse.length)]
            //             });
            //         } else {
            //             bot.reply(message, {
            //                 text: `${resp.get_infor_confirm[Math.floor(Math.random() * resp.get_infor_confirm.length)]} \n
            //                     emails: ${body.emails.join(',')} \n
            //                     Số điện thoại: ${body.phones.join(',')}`
            //                     ,
            //                     force_result: [
            //                     {
            //                         title: 'Đúng rồi',
            //                         payload: {

            //                         }
            //                     },
            //                     {
            //                         title: 'Sai rồi',
            //                         payload: {
            //                             'resubmit_infor': true,
            //                         },
            //                     },
            //                 ]
            //             })
            //             isGetInfor = false;

            //         }
            //     });
            // }
            // if (isGetIntent){
            //     console.log("get Intent");
            //     request.post(CONVERSATION_MANAGER_ENDPOINT, {
            //         json: {
            //             message: raw_mesg
            //         }
            //     }, (error, res, body) => {
            //         if (error) {
            //             console.log(error);
            //             conversation[message.user].push("bot: "+ resp.err );
            //             bot.reply(message, {
            //                 graph: {},
            //                 text: resp.err
            //             })
            //             return
            //         }
            //         // console.log("type: " + typeof(res.activity));
            //         var responseSentence;
            //         switch (body.message){
            //             case "activity":
            //                 responseSentence = resp.activity[Math.floor(Math.random() * resp.activity.length)];
            //                 break;
            //             case "joiner":
            //                 responseSentence = resp.joiner[Math.floor(Math.random() * resp.joiner.length)];
            //                 break;
            //             case "work":
            //                 responseSentence = resp.work[Math.floor(Math.random() * resp.work.length)];
            //                 break;
            //             case "contact":
            //                 responseSentence = resp.contact[Math.floor(Math.random() * resp.contact.length)];
            //                 break;
            //             case "register":
            //                 responseSentence = resp.register[Math.floor(Math.random() * resp.register.length)];
            //                 break;
            //             default:
            //                 responseSentence = resp.err
            //         }
            //         console.log(responseSentence);
            //         bot.reply(message, {text: responseSentence});

            //         responseSentence = resp.ask_infor[Math.floor(Math.random() * resp.ask_infor.length)];
            //         bot.reply(message, 
            //             {
            //                 text:responseSentence,
            //                 // isGetInfor: true
            //             });

            //     });
            //     isGetInfor = true;

            //     isGetIntent = false;

            // }

        }
    }
    controller.on('hello', conductOnboarding);
    controller.on('welcome_back', continueConversation);
    controller.on('message_received', callConversationManager);

}
