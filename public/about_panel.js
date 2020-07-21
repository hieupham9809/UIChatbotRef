var aboutPanel = $("#about-popup-panel");
var aboutContent = $(".about-popup-content");
var aboutClose = $(".about-popup-close");
function toggleAboutPanel() {
	var aboutPanelVisibility = aboutPanel.css('visibility');
	if (aboutPanelVisibility == 'hidden'){
		aboutPanel.css({visibility : 'visible'});
		aboutPanel.animate({
			opacity: 1
		}, 300, function(){
			
			aboutPanel.attr("tabindex",-1).focus();

		    // aboutPanel.click(function(){
		    // 	toggleAboutPanel();
		    // })
		})
	}
	else if (aboutPanelVisibility == 'visible') {
		aboutPanel.animate({
			opacity: 0
		}, 300, function(){
			
			aboutPanel.css({visibility : 'hidden'});
			aboutPanel.off("focusout");
		})
	}
}

aboutClose.click(function(){
	toggleAboutPanel();
});