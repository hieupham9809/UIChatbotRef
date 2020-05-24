
var timeout = null;
var isAddedSuggestPanel = false;
var ableToSuggest = true;
var suggestPanel = null;
var suggestSpinner = null;
const SUGGEST_API = 'http://127.0.0.1:5000/api/cse-assistant-conversation-manager/suggest-question';
var deleteElement = ()=> {
  $(suggestPanel).animate({
    height: '0px'
  }, 300, function(){
    $(suggestPanel).remove();
  });
  isAddedSuggestPanel = false;
}

var renderSuggest = (data) => {
  var list = document.createElement('ul');
  var replyList = document.getElementById('message_replies');
  if (suggestPanel != null){
    $("#suggest-panel ul").remove();
    
  }
  // replyList.innerHTML = '';
  // var elements = [];
  for (var r = 0; r < data.length; r++) {
    (function (reply) {
      

      var li = document.createElement('li');
      var el = document.createElement('a');
      el.innerHTML = data[r];
      el.href = '#';

      el.onclick = function () {
        // that.sendCustom(reply.title, reply.payload);
        
        if (Botkit != null){
          Botkit.sendCustom(el.innerHTML, {});
          ableToSuggest = false;
        }
      }

      li.appendChild(el);
      list.appendChild(li);
      
      // elements.push(li);

    })(data[r]);
  }
  if (suggestPanel != null){
    $(list).appendTo(suggestPanel);  
  }
  
  // replyList.appendChild(list);
}
var loadSuggest = (input) => {
  console.log(input);
  // $.post(SUGGEST_API, JSON.stringify({message : input}), function(data, status, xhr){
  //   console.log(status);
  //   console.log(data);
  // });
  if (input != ""){
    if (suggestSpinner != null){
      
      suggestSpinner.css("display", "block");
    }
    $.ajax({
      type: 'post',
      url: SUGGEST_API,
      data: JSON.stringify({message : input}),
      contentType: "application/json; charset=utf-8",
      traditional: true,
      success: function (data) {
          console.log(data.result);
          renderSuggest(data.result);
          suggestSpinner.css("display", "none");

      },
      error: function(jqXHR, textStatus, errorThrown){
          suggestSpinner.css("display", "none");
          console.log('error: ' + errorThrown);
      }
    });
  }
  
}


$("#messenger_input").on('input',function(e){
  if (ableToSuggest){
    if (!isAddedSuggestPanel){
      var messageList = $("#message_list");
      suggestPanel = $('<div />', { 
          id: 'suggest-panel'
        });
      
      suggestSpinner = $('<div/>', {
        id: 'suggest-loader-spinner'
      });
      suggestSpinner.appendTo(suggestPanel);
      
      suggestPanel.appendTo(messageList);
      
      suggestPanel.animate({
        height : '170px'
      }, 300, function(){

      });
      isAddedSuggestPanel = true
    }
    if (e.target.value.trim() == ""){
      deleteElement();
    }
    if (timeout != null){
      clearTimeout(timeout);
    }
    timeout = setTimeout(()=>{loadSuggest(e.target.value.trim())}, 1000);
  }
});
