resp = require("../response/response.js");
request = require("request");
sync = require('sync-request');

var UserController = require("../utils/usercontroller.js")
// const CONVERSATION_MANAGER_ENDPOINT = "https://nameless-basin-64349.herokuapp.com/api/LT-conversation-manager"
const CONVERSATION_MANAGER_ENDPOINT = "http://127.0.0.1:5000/api/cse-assistant-conversation-manager"
// const CONVERSATION_MANAGER_ENDPOINT = "http://80.211.158.164/api/cse-assistant-conversation-manager"
// const CONVERSATION_MANAGER_ENDPOINT = "http://127.0.0.1:5000/api/test_matchfound"
// const CONVERSATION_MANAGER_ENDPOINT = "http://127.0.0.1:5000/api/test_edit_inform_inform"
// const CONVERSATION_MANAGER_ENDPOINT = "http://127.0.0.1:5000/api/test_edit_inform_inform"
// const CONVERSATION_MANAGER_ENDPOINT = "http://127.0.0.1:5000/api/test_inform_empty"

// const CONVERSATION_MANAGER_ENDPOINT = "http://127.0.0.1:5000/api/test_edit_inform_matchfound"


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
    function handleMatchfoundResponse(bot, message, body){
        var matchFoundSlot = 'activity';
        var enableResponseToMathfound = null;
        var enableEditInform = null;
        var listResults = null;
        if (body.agent_action.inform_slots[matchFoundSlot] != 'no match available'){
            keyListResults = body.agent_action.inform_slots[matchFoundSlot]
            listResults = body.agent_action.inform_slots[keyListResults]
            enableResponseToMathfound = [
                {
                    title: 'Cảm ơn',
                    payload: {
                        'userResponeToMatchfound': {
                            'acceptMatchfound': true,
                            'userAction': body.agent_action
                        }
                    },
                },
                {
                    title: 'Không thỏa mãn',
                    payload: {
                        'userResponeToMatchfound': {
                            'acceptMatchfound': false,
                            'userAction': body.agent_action
                        }
                    }
                }
            ]
        } else {
            enableEditInform = body.current_informs
        }
        bot.reply(message, {
            text: body.message,
            enableResponseToMathfound: enableResponseToMathfound,
            listResults : listResults,
            enableEditInform: enableEditInform
        });
    }
    function handleInformResponse(bot, message, body){
        var slot = Object.keys(body.agent_action.inform_slots)[0]
        var enableResponseToConfirm = null;
        var enableEditInform = null;

        if (body.agent_action.inform_slots[slot] != 'no match available'){

            if (body.agent_action.inform_slots[slot].length == 0){
                var enableEditInformWhenDenied = null;
                if (body.current_informs != 'null')
                    enableEditInformWhenDenied = body.current_informs;
                enableResponseToConfirm = [
                    
                    {
                        title: 'Đồng ý',
                        payload: {
                            'userResponeToInform': {
                                'anything': true,
                                'userAction': body.agent_action
                            }
                        }
                    },
                    {
                        title: 'Không',
                        payload: {
                            'userResponeToInform': {
                                'acceptInform': false,
                                'enableEditInform': enableEditInformWhenDenied,
                                'userAction': body.agent_action
                            }
                        }
                    }
                ]
            } else {
                
                enableResponseToConfirm = [
                    {
                        title: 'Đồng ý',
                        payload: {
                            'userResponeToInform': {
                                'acceptInform': true,
                                'userAction': body.agent_action
                            }
                        },
                    },
                    {
                        title: 'Sao cũng được',
                        payload: {
                            'userResponeToInform': {
                                'anything': true,
                                'userAction': body.agent_action
                            }
                        }
                    },
                    {
                        title: 'Không',
                        payload: {
                            'userResponeToInform': {
                                'acceptInform': false,
                                'userAction': body.agent_action
                            }
                        }
                    }
                ]
            }
            

            console.log("RESPONSE CONFIRM")
        } else {
            if (body.current_informs != 'null')
                enableEditInform = body.current_informs;
        }
        bot.reply(message, {
            text: body.message,
            enableResponseToConfirm: enableResponseToConfirm,
            enableEditInform : enableEditInform
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
            // if (raw_mesg.trim().toLowerCase() == "bye") {
            //     bot.reply(message, {
            //         text: resp.goodbye[Math.floor(Math.random() * resp.goodbye.length)],
            //         force_result: [
            //             {
            //                 title: 'Bắt đầu hội thoại mới',
            //                 payload: {
            //                     'restart_conversation': true
            //                 }
            //             }
            //         ]
            //     });

            //     var success = userController.deleteSession(id);
            //     if (!success) {
            //         console.log("Error in delete function");
            //     } else {
            //         console.log("Delete success");
            //     }
            //     return;
            // }
            var messageBack = raw_mesg;
            if (message.userResponeToInform != null){
                if (message.userResponeToInform.anything){
                    userAction = message.userResponeToInform.userAction;
                    for (var prop in userAction.inform_slots){
                        // if (userAction.inform_slots.hasOwnProperty(prop)){
                        //     userAction.inform_slots.prop = 'anything'
                        // }
                        userAction.inform_slots[prop] = 'anything';
                    }
                    delete userAction.round;
                    delete userAction.speaker;
                    messageBack = userAction;
                }
                else if (message.userResponeToInform.acceptInform){
                    userAction = message.userResponeToInform.userAction;
                    delete userAction.round;
                    delete userAction.speaker;
                    messageBack = userAction;
                } else {
                    var enableEditInform = null;
                    userAction = message.userResponeToInform.userAction;
                    slot = resp.AGENT_INFORM_OBJECT[Object.keys(userAction.inform_slots)[0]];
                    var msg = `Mời bạn cung cấp lại thông tin ${slot} nhé!`;
                    if (message.userResponeToInform.enableEditInform != null){
                        enableEditInform = message.userResponeToInform.enableEditInform;
                        msg = `Vậy bạn điều chỉnh lại thông tin giúp mình nhé!`;
                    }
                    
                    bot.reply(message, {
                            text: msg,
                            enableEditInform : enableEditInform
                        });
                    return;
                    
                }
            }
            if (message.userResponeToMatchfound != null){
                if (message.userResponeToMatchfound.acceptMatchfound){
                    messageBack = {intent: "done", inform_slots:{}, request_slots: {}}
                } else {
                    messageBack = {intent: "reject", inform_slots:{}, request_slots: {}}
                }
            }
            if (message.userEditedInformSlot != null){
                userAction = {intent: "inform", request_slots: {}, inform_slots:message.userEditedInformSlot.userInform};
                messageBack = userAction;
            }
            console.log("request action::#########")
            console.log(messageBack)
            request.post(CONVERSATION_MANAGER_ENDPOINT, {
                json: {
                    message: messageBack,
                    state_tracker_id: id
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
                if (body != null && body.agent_action != null){
                    console.log(body.agent_action)
                    switch (body.agent_action.intent){
                        case "inform":
                            handleInformResponse(bot, message, body);
                            break;
                        case "match_found":
                            console.log(body.agent_action.inform_slots[body.agent_action.inform_slots['activity']])

                            handleMatchfoundResponse(bot, message, body);
                            break;
                        default:
                            bot.reply(message, {
                                text: body.message
                            })
                    }

                    return;
                }
                // console.log("agent: " + body)
                // bot.reply(message, {
                //     text: body.message
                // })
               


            });

            // bot.reply(message, {
            //     text: response_body.question,
            //     graph: graph,
            //     force_result: [
            //         {
            //             title: 'Bỏ tiếp yêu cầu',
            //             payload: {
            //                 'remove_more': true
            //             },
            //         },
            //         {
            //             title: 'In luôn kết quả',
            //             payload: {
            //                 'force_show': true
            //             }
            //         }
            //     ]
            // })

        }
    }
    controller.on('hello', conductOnboarding);
    controller.on('welcome_back', continueConversation);
    controller.on('message_received', callConversationManager);

}
