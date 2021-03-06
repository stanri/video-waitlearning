//HELPER METHODS AND 'GLOBAL' VARIABLES
var DEBUG = false;
var typeOfProblem = 'flashcard'; //choose one of flashcard, fill_in_the_blank, or how_to

//attaches the css file to the document to allow us to style our extension.
function attach_css(){
    var link = document.createElement("link");
    link.href = chrome.extension.getURL("css/learning.css");
    link.type = "text/css";
    link.rel = "stylesheet";
    document.getElementsByTagName("head")[0].appendChild(link);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

//map = {'type': 'flashcard', 'native': word.englishWord, 'foreign': translationDict[foreignLanguage],
//                      'learningPanel': learningPanel, 'leftpos': leftpos, 'toppos': toppos};
function parseMap(map) {
    if (map['type'] == 'flashcard') {
        return Flashcard(map['leftpos'], map['toppos'], map['learningPanel'], map['model']);
    }
    else if (map['type'] == 'fill_in_the_blank') {
        return Fill_In_The_Blank(map['leftpos'], map['toppos'], map['learningPanel'], map['model']);
    }
}

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [v1.0]
//Fisher-Yates shuffle, shuffles a list in place.
function shuffle(o){ //v1.0
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
//    return o;
}

function getKeyFromValue(value) {
    for (var prop in this) {
        if (this.hasOwnProperty(prop)) {
             if (this[prop] === value)
                 return prop;
        }
    }
}

//MODELS

//Objects of the Word class are stored in model to pull words
//for the user to use in their exercises.
//englishWord - the word in English
//translationDict - a dictionary of the words translations, in the form {language: translation}
//numUnderstood - number of times the user has said they understand this word. (CURRENTLY NOT IMPLEMENTED FOR DEV PURPOSES)
var Word = function(englishWord, translationDict) {
    var that = {};
    var self = this;
    //TODO: add to numUnderstood upon clicking Got it in flashcard and correct answers in fill_in_the_blank
    that.numUnderstood = 0;

    //Add a translation of an existing word.
    that.addTranslation = function(language, translation) {
        translationDict[language.toLowerCase()] = translation.toLowerCase();
    }

    that.getEnglishWord = function () {
        return englishWord;
    }

    that.getTranslationDict = function() {
        return translationDict;
    }

    // Object.freeze(that); don't think this should be done : adding words to dictionary in future?
    return that;
}

//learningPanel - div that contains the exercise elements.
//vocab - list of Word objects
//leftpos - an integer describing the left positioning of the learningPanel, in pixels.
//toppos - an integer describing the top positioning of the learningPanel, in pixels.
var Model = function(learningPanel, vocab, leftpos, toppos) {
    var that = {};
    var self = this;
    var foreignLang = 'spanish';
    var nativeLang = 'english';
    //add to this to support additional languages.
    var languageCodeDict = {'spanish': 'ESP', 'english': 'ENG', 'german': 'DEU', 'italian': 'ITA', 'portuguese': 'POR', 'elvish': 'elf'}

    //Gets a random Word object stored in vocab and returns it to the user.
    var getRandomWord = function() {
        var num = getRandomInt(0, vocab.length);
        return vocab[num];
    }

    //word - Word object to be added to the vocab list
    that.addWord = function(word) {
        vocab.append(word)
    }

    that.getNativeLanguage = function() {
        return nativeLang;
    }

    that.getForeignLanguage = function() {
        return foreignLang;
    }

    //returns the languageCodeDict
    that.getLanguageCodeDict = function() {
        return languageCodeDict;
    }

    //Returns an object of information to be used to create the exercise.
    that.getExerciseMap = function(model) {
        var map;
        var selectNewCard = true;
        while (selectNewCard) {
            var word = getRandomWord();
            var translationDict = word.getTranslationDict();
            if (typeOfProblem == 'flashcard') {
                map = {'type': 'flashcard', 'native': word.getEnglishWord(), 'foreign': translationDict[foreignLang],
                      'learningPanel': learningPanel, 'leftpos': leftpos, 'toppos': toppos, 'model': model};
                selectNewCard = false;
            }
            else if (typeOfProblem == 'fill_in_the_blank') {
                map = {'type': 'fill_in_the_blank', 'native': word.getEnglishWord(), 'foreign': translationDict[foreignLang],
                      'learningPanel': learningPanel, 'leftpos': leftpos, 'toppos': toppos, 'model': model};
                selectNewCard = false;
            }
        }
        return map;
    }
    return that;
}

//CARD TYPES

//IMPORTANT:
//FOR ALL CLASSES, THE ORDER OF WORDS IS:
//Foreign Word (on top)
//Native Word (on bottom)

//the Flashcard object is an exercise type that helps users first learn a word in
//another language by allowing them to guess at the word in their head and reveal it.
//leftpos - an integer describing the left positioning of the learningPanel, in pixels.
//toppos - an integer describing the top positioning of the learningPanel, in pixels.
//learningPanel - div that contains the exercise elements.
//model - instance of the Model class, defined above.
var Flashcard = function(leftpos, toppos, learningPanel, model){
    var that = {};
    var self = this;
    var left = $("<div>").addClass("flash-left");
    var left_top = $("<div>").addClass("subsection").attr('id', 'topPanel');
    var left_bottom = $("<div>").addClass("subsection").attr('id', 'bottomPanel');
    var right = $("<div>").addClass("flash-right").attr("id", "not-clickable");
    var right_top = $("<div>").addClass("subsection").text("Got it!")
                                                     .css({'font-size':'50%', 'font-style':'italic'});
    var right_bottom = $("<div>").addClass("subsection").text("Darn! Missed it.")
                                                        .css({'font-size':'50%', 'font-style':'italic'});
    var foreignPanel = $("<div>").addClass("flash-langPanel");
    var nativePanel = $("<div>").addClass("flash-langPanel");
    var revealButton = $("<button>").addClass("flash-reveal").text("reveal");
    var revealed = false;
    var correct = $("<img>").addClass("check")//.addClass("not-clickable");
    correct.attr('src', chrome.extension.getURL('static/right.png'));
    var wrong = $("<img>").addClass("check")//.addClass("not-clickable");
    wrong.attr('src', chrome.extension.getURL('static/wrong.png'));

    var setPosition = function(){
        learningPanel.css("width", "400px");
        learningPanel.css("height", "125px");
        learningPanel.css("left", leftpos + "px");
        learningPanel.css("top", toppos + "px");
    };

    //l1 and l2 are strings
    //l1 = native, l2 = foreign
    that.showExercise = function(l1, l2){
        foreignPanel.text(l2);
        nativePanel.text(l1);

        var langCodeDict = model.getLanguageCodeDict();
        var l1Code = langCodeDict[model.getNativeLanguage()];
        var l2Code = langCodeDict[model.getForeignLanguage()];

        left.append(left_top).append(left_bottom);
        left_top.text(l2Code).append(foreignPanel);
        left_bottom.text(l1Code).append(nativePanel);
        right.append(right_top).append(right_bottom);
        right_top.append(correct);
        right_bottom.append(wrong);
        learningPanel.append(left);
        learningPanel.append(right);

        //randomly choose which language is hidden
        if (Math.random() >= .5) {
            nativePanel.hide();
            left_bottom.append(revealButton);
        }
        else {
            foreignPanel.hide();
            left_top.append(revealButton);
        }

        revealButton.click(function() {
            revealed = true;
            right.attr('id', 'clickable');
            if (nativePanel.is(':hidden')) {
                left_bottom.find('p').remove(); //removes alert text if present
                revealButton.hide();
                nativePanel.show();
            }
            else {
                left_top.find('p').remove(); //removes alert text if present
                revealButton.hide();
                foreignPanel.show();
            }
        });

        $('.check').click(function() {
            if (revealed) {
                right.attr('id', 'not-clickable');
                var map = model.getExerciseMap(model);
                learningPanel.empty();
                var newCard = parseMap(map);
                setTimeout(function(){newCard.showExercise(map['native'], map['foreign'])}, 300);
            }
            else {
                if (nativePanel.is(':hidden')) {
                    left_bottom.find('p').remove();
                    left_bottom.append($('<p>Reveal the word first!</p>'));
                }
                else {
                    left_top.find('p').remove();
                    left_top.append($('<p>Reveal the word first!</p>'));
                }
            }
        });
        return;
    };

    setPosition();
    Object.freeze(that);
    return that;
};

//Fill_In_The_Blank is a question type that lets the user
//type in their translation to a word, either native or foreign.
//leftpos - an integer describing the left positioning of the learningPanel, in pixels.
//toppos - an integer describing the top positioning of the learningPanel, in pixels.
//learningPanel - div that contains the exercise elements.
//model - instance of the Model class, defined above.
var Fill_In_The_Blank = function(leftpos, toppos, learningPanel, model) {
    var that = {};
    //variables below used for showExercise method.
    var answer; //this is set as l1 or l2 in showExercise.
    var rand = Math.random();
    var maxAttempts = 3;
    var attempts = 0;
    var left = $("<div>").addClass("left fill_in_the_blank");
    var right = $("<div>").addClass("right fill_in_the_blank");
    var lefttop = $("<div>").addClass("left_subsection fill_in_the_blank");
    var leftbottom = $("<div>").addClass("left_subsection fill_in_the_blank");
    var foreignPanel = $("<div>").addClass("foreignPanel fill_in_the_blank");
    var nativePanel = $("<div>").addClass("nativePanel fill_in_the_blank");
    var answerStatus = $("<div>").addClass("answerStatus fill_in_the_blank");
    var revealButton = $("<button>").addClass("revealButton fill_in_the_blank").text('reveal').attr('type', 'button');
    var loadingDiv = $('<div>').addClass("loading").text('');
    var remainingAttemptsDiv = $('<div>').addClass("remaining_attempts").text('Remaining attempts: ' + (maxAttempts - attempts));

    var setPosition = function(){
        learningPanel.css("width", "400px");
        learningPanel.css("height", "125px");
        learningPanel.css("left", leftpos + "px");
        learningPanel.css("top", toppos + "px");
    };

    var compareAnswer = function(answer) {
        var submittedTranslation;
        try {
            submittedTranslation = $('#fitb_translation_field').val().toLowerCase();
        }

        catch(err) {
            console.log('Your string was improperly formatted.');
        }

        if (submittedTranslation == answer) {
            var dots = '';
            var timeToNext = 1750; //in milliseconds
            var url = chrome.extension.getURL("static/right.png");
            $('.answerStatus.fill_in_the_blank').html('<img id="right" src=' + url + ' />')
            var map = model.getExerciseMap(model);
            var newCard = parseMap(map);
            remainingAttemptsDiv.fadeOut(timeToNext/3);
            function next() {
                dots += '.';
                loadingDiv.text(dots);
                if (dots.length < 3) {
                    setTimeout(next, timeToNext/4);
                }
            }
            setTimeout(next, timeToNext/4);
            setTimeout(function(){ newCard.showExercise(map['native'], map['foreign']); }, timeToNext);

        }

        else {
            attempts++;
            remainingAttemptsDiv.text('Remaining attempts: ' + (maxAttempts - attempts));
            var url = chrome.extension.getURL("static/wrong.png");
            $('.answerStatus.fill_in_the_blank').html('<img id="wrong" src=' + url + ' />');
            $('#fitb_translation_field').attr('placeholder', '').val('');
            $('#fitb_translation_field').addClass('fitb_try_again');
            setTimeout(function(){
                $('#fitb_translation_field').attr('placeholder', 'try again');
                $('.fitb_try_again::-webkit-input-placeholder').fadeIn(1000);
            }, 1000);
            $('#wrong').fadeOut(1250);
            $('.revealButton.fill_in_the_blank').css('display', 'inline');
            if (attempts >= maxAttempts) {
                remainingAttemptsDiv.empty();
                revealButton.click();
            }


            revealButton.click(function() {
                var dots = '';
                var timeToNext = 1750;

                var replacementDiv = $('<div>').addClass("fitb_translation").attr('id', 'fitb_translation_div').text(answer);
                $('#fitb_translation_field').replaceWith(replacementDiv);
                replacementDiv.css('position', 'absolute').css('left', '4px');
                $('.revealButton.fill_in_the_blank').css('display', 'none');
                $('.answerStatus.fill_in_the_blank').html('<img id="wrong" src=' + url + ' />')
                var map = model.getExerciseMap(model);
                var newCard = parseMap(map);

                function next() {
                    dots += '.';
                    loadingDiv.text(dots);
                    if (dots.length < 3) {
                        setTimeout(next, timeToNext/4);
                    }
                }
                setTimeout(next, timeToNext/4);

                setTimeout(function(){ newCard.showExercise(map['native'], map['foreign']); }, timeToNext);
            });
        }
    }

    //l1 and l2 are strings
    //l1 = native, l2 = foreign
    that.showExercise = function(l1, l2){
        var lang;
        var topQuantity;
        var nativeBlank;
        var langDict = model.getLanguageCodeDict();
        learningPanel.empty();
        foreignPanel.html(l2);
        nativePanel.html(l1);
        var inputField = '<input type="text" value="" autocomplete="off" class="fitb_translation" id="fitb_translation_field">';
        if (rand > .5) {
            nativePanel.html(inputField);
            lang = model.getNativeLanguage();
            answer = l1;
            nativeBlank = true;

        }
        else {
            foreignPanel.html(inputField);
            lang = model.getForeignLanguage();
            answer = l2;
            nativeBlank = false;
        }

        lefttop.append(foreignPanel);
        leftbottom.append(nativePanel);
        left.append(lefttop).append(leftbottom);
        right.append(answerStatus).append(revealButton).append(loadingDiv).append(remainingAttemptsDiv);
        learningPanel.append(left).append(right);

        //CSS below used to align text in input field and text in div.
        if (nativeBlank) {
            $('.foreignPanel.fill_in_the_blank').css('left', '4px').css('top', '14px');
            $('.revealButton.fill_in_the_blank').css('top', '64%');
        }
        else {
            $('.nativePanel.fill_in_the_blank').css('left', '4px').css('top', '77px');
            $('.revealButton.fill_in_the_blank').css('top', '23%');
        }
        $('#fitb_translation_field').attr('placeholder', 'translate to ' + lang);
        $('#fitb_translation_field').focus();

        $('#fitb_translation_field').keydown(function(e) {
            if (e.which==13 || e.keyCode==13) {
                compareAnswer(answer);
                e.preventDefault();
                return false;
            }
        });

        return;
    };

    setPosition();
    Object.freeze(that);
    return that;
}

//Class that creates objects to be used for larger, draggable problems.
//helpText - text to accompany the image or, if no path is provided, text used for the draggable item.
//path - optional argument, used to link to an existing image. if passed in, start with static/...
var Item = function(helpText, path) {
    //note: if path not passed in, expect it to be 'undefined'
    var that = {};
    var atTop = false;
    var container = $("<div>").addClass('item_container');

    that.getInfo = function() {
        return {'helpText': helpText, 'path': path};
    }

    that.toTop = function() {
        atTop = true;
    }

    that.toBottom = function() {
        atTop = false;
    }

    that.toggleAtTop = function() {
        atTop = !atTop;
    }

    that.getAtTop = function() {
        return atTop;
    }

    that.getPath = function() {
        return path;
    }

    that.onClick = function(handler) {
        container.click(function() {
            handler();
        });
    }

    that.reset = function() {
        container.empty();
        atTop = false;
    }

    that.getContainer = function() {
        return container;
    }

    //Use this to test equality between two item instances.
    that.itemEquals = function(item2) {
        if (helpText === item2.getInfo()['helpText'] && path === item2.getInfo()['path']) {
            return true;
        }
        return false;
    }

    that.generateHTML = function() {
        var image = $("<img>").addClass("item_image");
        image.attr('src', chrome.extension.getURL(path));
        var helpTextSpan = $("<span>").addClass("item_helpText");
        //var container = $("<div>").addClass('item_container');
        container.append(image).append(helpTextSpan);
        helpTextSpan.text(helpText);
        container.get(0).itemobj = that;
        return container;
    }

    that.makedraggable = function(){
        container.draggable({
            cursor: 'move',
            snap: '.dashed-subsection,.solid-subsection'
        });
    }

    return that;
}

//A group is a collection of items, representing steps in a problem or in a sentence, that follow each other in order, with
//the first step at the 0 index and the last step at the nth index, where n is len(items) - 1.
var Group = function(name, items) {
    var that = {};

    that.getName = function() {
        return name;
    }

    that.getItems = function() {
        return items;
    }

    that.length = items.length;

    return that;
}

//never run methods from this class on this class itself!
//run the methods on instances of the subclasses (don't run moveItems
//on this class, run it on a How_To so compareAnswer from that class is run)
var Ordered_Box = function(group) {
    var that = {};
    var items = group.getItems();
    var top = $('<div>').attr('id','ordered-top');
    var bottom = $('<div>').attr('id', 'ordered-bottom');
    //var userAnswer = {0: null, 1: null, 2: null, 3: null};
    //var shuffledItems = {0: null, 1: null, 2: null, 3: null};
    var userAnswer = {};
    var shuffledItems = {};
    var done = false;
    var ANSWER = items;
    var resetAllButton = $('<button>').addClass('reset_all_button').addClass('how_to').text('start over').attr('type', 'button');
    var nextButton = $('<button>').addClass('next_button').addClass('how_to').text('next').attr('type', 'button');
    var revealButton = $('<button>').addClass('reveal_button').addClass('how_to').text('give up').attr('type', 'button');
	
	//for numbering dashed boxes
	/*var one = $('<div>').addClass('ordered_box_num').text('1').attr('id', 'one');
	var two = $('<div>').addClass('ordered_box_num').text('2').attr('id', 'two');
	var three = $('<div>').addClass('ordered_box_num').text('3').attr('id', 'three');
	var four = $('<div>').addClass('ordered_box_num').text('4').attr('id', 'four');
	var nums = [one,two,three,four];*/
	
	//dummy spans for vertical centering of numbers
	/*var dummySpan1 = $('<span>').addClass('dummy_span');
	var dummySpan2 = $('<span>').addClass('dummy_span');
	var dummySpan3 = $('<span>').addClass('dummy_span');
	var dummySpan4 = $('<span>').addClass('dummy_span');
	var dummySpans = [dummySpan1, dummySpan2, dummySpan3, dummySpan4];*/

    var bigRight = $('<img>').addClass('big_right').addClass('how_to');
    var bigWrong = $('<img>').addClass('big_wrong').addClass('how_to');
    bigRight.attr('src', chrome.extension.getURL("static/bigright.png"));
    bigWrong.attr('src', chrome.extension.getURL("static/bigwrong.png"));

    for (var i in items) {
        var dashed_subdiv = $('<div>').addClass('dashed-subsection');
        var solid_subdiv = $('<div>').addClass('solid-subsection');
        top.append(dashed_subdiv);
        bottom.append(solid_subdiv);
    }


    //could change this implementation to read userAnswer, but it's nbd.
    var allAtTop = function() {
        var allAtTop = true
        $('#ordered-top > .dashed-subsection').each(function() {
            if ($(this).is(':empty')) {
                allAtTop = false;
            }
        });
        return allAtTop;
    }

    var compareAnswer = function() {
        var equal = true;
        done = true;

        bigRight.css('display', 'none');
        bigWrong.css('display', 'none');
        nextButton.css('display', 'none');

        for (i in ANSWER) {
            if (ANSWER[i].getPath() != userAnswer[i].getPath()) {
                setTimeout(function() { //wait for animation to finish
                    $('.item_container').effect('shake');
                    $('#ordered-top > .dashed-subsection').css('border-color', 'red');
                }, 600);
                bigWrong.css('display', 'inline');
                equal = false;
                break;
            }
        }

        if (equal) { //user is correct
            bigWrong.css('display', 'none');
            revealButton.css('display', 'none');
            setTimeout(function() { //wait for animation to finish
                $('#ordered-top > .dashed-subsection').css('border-color', 'green');
                bigRight.css('display', 'inline');
                nextButton.css('display', 'inline');
            }, 600);
        }

        else {
            bigWrong.css('display', 'inline');
            revealButton.css('display', 'inline');
        }
    }

    var moveItemViaDrag = function(item,targetelem){
        var container = item.getContainer();
        if(item.getAtTop() == true){
            var index = getKeyFromValue(item);
            container.css("left", "auto");
            container.css("top","auto");
            targetelem.append(container);
        }else{
            var index = $(".dashed-subsection").index(targetelem);
            userAnswer[index] = item;
            targetelem.append(container);
            container.css("left", "auto");
            container.css("top","auto");
        }

        if (targetelem.attr('class') == 'solid-subsection ui-droppable') {
            item.toBottom();
        } else if (targetelem.attr('class') == 'dashed-subsection ui-droppable') {
            item.toTop();
        }

        if (allAtTop()) {
            compareAnswer();
        }
    }


    var moveItem = function(item) {
        var container = item.getContainer();
        var counter = 0;

        if (done) {
            bigRight.css('display', 'none');
            bigWrong.css('display', 'none');
            nextButton.css('display', 'none');
            revealButton.css('display', 'inline');
            $('#ordered-top > .dashed-subsection').css('border-color', 'gray');
            done = false;
        }

        if (item.getAtTop() == true) {
            var index = getKeyFromValue(item); //return 0 through len(items) - 1, key from dict indicating position at top.
            $('#ordered-bottom > .solid-subsection').each(function() {
                var newLoc = $(this);
                if (newLoc.is(':empty')) {
					//nums[counter].css('display', 'none');
                    item.toggleAtTop();
                    container.toggle('puff', {percent:110}, 100, function() {
                        newLoc.append(container);
//                        userAnswer[movingFrom] = null;
                        shuffledItems[counter] = item;
                    });
                    container.toggle('puff', {percent:110}, 500);
                    return false
                }
                counter++;
            });
        }
        else {
            $('#ordered-top > .dashed-subsection').each(function() {
                var newLoc = $(this);
                if (newLoc.is(':empty')) {
					//nums[counter].css('display', 'none')
                    item.toggleAtTop();
                    container.toggle('puff', {percent:110}, 100, function() {
                        newLoc.append(container);
                        userAnswer[counter] = item;
                    });
                    container.toggle('puff', {percent:110}, 500);
                    return false;
                }
                counter++;
            });
        }

        setTimeout(function() { //wait for animation to finish
            if (allAtTop()) {
                compareAnswer();
            }
        }, 200);
    }

    that.How_To = function(leftpos, toppos, learningPanel) {
        var self = this;
        var that = {};
        var ANSWER = items;

        var setPosition = function() {
            learningPanel.css('width', '854px');
            learningPanel.css('height', '475px');
            learningPanel.css("left", leftpos + "px");
            learningPanel.css("top", toppos + "px");
        }

        that.showExercise = function() {
            learningPanel.empty();
           bottom.append(resetAllButton).append(nextButton).append(bigRight).append(bigWrong).append(revealButton);
            learningPanel.append(top).append(bottom);

            var userItems = $.extend([], ANSWER);
            var trueArray = []; //if all elts in it are true, need to shuffle again.

            do {
                shuffle(userItems);
                for (i in userItems) {
                    var result = userItems[i].itemEquals(ANSWER[i]);
                    trueArray.push(result);
                }
                if ($.inArray(false, trueArray, 0) > -1) {
                    break;
                }
                trueArray = [];
            } while (true);

            for (var i in userItems) {
                //shuffledItems is an object, declared in Ordered_Box, while userItems is the shuffled version
                //of ANSWER list.
                shuffledItems[i] = userItems[i];
            }

            //initial appending of items
            var initpos = 0;
            $('#ordered-bottom > .solid-subsection').each(function() {
                var item = shuffledItems[initpos];
                $(this).append(item.generateHTML());
                //item.makedraggable();
                function attachClickHandler(item) {
                    item.onClick(function() {
                        moveItem(item);
                    });
                }
                attachClickHandler(item);
                initpos++;
            });

			//number dashed boxes
			//for (var i in nums) { learningPanel.append(nums[i]); }
			
			/*//number dashed boxes
			var numsindex = 0
			$('#ordered-top > .dashed-subsection').each(function() { 
				$(this).append(dummySpans[numsindex]);
				$(this).append(nums[numsindex]);
				numsindex++;
			});*/

            resetAllButton.click(function() {
                revealButton.css('display', 'inline');
                bigRight.css('display', 'none');
                bigWrong.css('display', 'none');
                nextButton.css('display', 'none');
                $('#ordered-top > .dashed-subsection').css('border-color', 'gray');
                done = false;

                for (i in userItems) {
                    userItems[i].reset();
                }
                $('#ordered-top > .dashed-subsection').each(function() { $(this).empty(); });
                $('#ordered-bottom > .solid-subsection').each(function() { $(this).empty(); });
                userAnswer = {0: null, 1: null, 2: null, 3: null};
                shuffledItems = {0: null, 1: null, 2: null, 3: null};
                for (var i in userItems) { shuffledItems[i] = userItems[i]; }
                var initposi = 0;
                $('#ordered-bottom > .solid-subsection').each(function() {
                    var item = shuffledItems[initposi];
                    $(this).append(item.generateHTML());
                    //item.makedraggable();
                    function attachClickHandler(item) {
                        item.onClick(function() {
                            moveItem(item);
                        });
                    }
                    attachClickHandler(item);
                    initposi++;
                });
            });

            nextButton.click(function() {
                var currentGroupName = group.getName();
                $('#ordered-top > .dashed-subsection').each(function() { $(this).empty(); });
                $('#ordered-bottom > .solid-subsection').each(function() { $(this).empty(); });
                for (i in userItems) { userItems[i].reset(); }
                if (currentGroupName == 'eggs') {
                    var ob = Ordered_Box(absGroup);
                    var ht = ob.How_To(0, 0, learningPanel);
                    ht.showExercise();
                }
                else if (currentGroupName == 'abs') {
                    var ob = Ordered_Box(eggGroup);
                    var ht = ob.How_To(0, 0, learningPanel);
                    ht.showExercise();
                }
            });

            revealButton.click(function() {
                $('#ordered-top > .dashed-subsection').each(function() { $(this).empty(); });
                $('#ordered-bottom > .solid-subsection').each(function() { $(this).empty(); });
                $('#ordered-top > .dashed-subsection').css('border-color', 'gray');
                done = true;

                for (i in userItems) { userItems[i].reset(); }
                for (i in userItems) { userItems[i].toTop(); }

                var index = 0;
                $('#ordered-top > .dashed-subsection').each(function() {
                    var item = ANSWER[index];
                    $(this).append(item.generateHTML());


                    //item.makedraggable();
                    for (var i in ANSWER) { userAnswer[i] = ANSWER[i]; };
                    compareAnswer();
                    function attachClickHandler(item) {
                        item.onClick(function() {
                            moveItem(item);
                        });
                    }
                    attachClickHandler(item);
                    index++;
                });
                //601 because the setTimeout for visibility of bigRight in compareAnswer has duration 600.
//                setTimeout(function() {bigRight.css('display', 'none');}, 601);
                bigWrong.css('display', 'inline');
                bigRight.css('display', 'none');
            });

           // makedroppable();
        }


        var makedroppable = function(){
            $(".dashed-subsection").droppable({
                drop: function(event, ui){
                    moveItemViaDrag(ui.draggable.get(0).itemobj, $(this));
                }
            });
            $(".solid-subsection").droppable({
                drop: function(event, ui){
                    moveItemViaDrag(ui.draggable.get(0).itemobj, $(this));
                }
            });

            function handleDropEvent(event,ui){
                moveItemViaDrag(ui.draggable.get(0).itemobj, target);
            }
        }

        setPosition();
        Object.freeze(that);
        return that;
    }
    return that;
}

//all vocab should be lowercase, no punctuation.
var people = Word('people', {'spanish': 'personas'})
var government = Word('government', {'spanish': 'gobierno'})
var thing = Word('thing', {'spanish': 'cosa'})
var cat = Word('cat', {'spanish': 'gato'})
var war = Word('war', {'spanish': 'guerra'})
var computer = Word('computer', {'spanish': 'computadora'})
var sad = Word('sad', {'spanish': 'triste'})
var vocab = [people, government, thing, cat, war, computer, sad];

//items initialized for how_to exercises.
var egg1 = Item('Prep the pan.', 'static/stepimages/egg1.png');
var egg2 = Item('Prep the egg.', 'static/stepimages/egg2.png');
var egg3 = Item('Put the egg on the pan.', 'static/stepimages/egg3.png');
var egg4 = Item('Cook egg.', 'static/stepimages/egg4.png');
var abs1 = Item('Eat food.', 'static/stepimages/abs1.png');
var abs2 = Item('Buy ab-hancer.', 'static/stepimages/abs2.png');
var abs3 = Item('???', 'static/stepimages/abs3.png');
var abs4 = Item('Profit.', 'static/stepimages/abs4.png');
var eggGroup = Group('eggs', [egg1, egg2, egg3, egg4]);
var absGroup = Group('abs', [abs1, abs2, abs3, abs4]);

//VIEW (kind of)

//$('.videoAdUiAttribution') contains ad time left information, and returns null if no ad is playing.
//design based on this, so that our extension doesn't show when this selector returns null.
$(document).ready(function(){
    attach_css();
    function initializeProblems(timeLeft) {
        // get controls and position
        var controls = $(".html5-video-controls");
        var controls_leftpos = controls.position().left;
        var controls_toppos = controls.position().top;

        // create and attach learningPanel before controls
        var flashcard_leftpos = controls_leftpos;
        var flashcard_toppos = controls_toppos - 131;
        var learningPanel = $("<div>").attr("id", "learningPanel").addClass("learningPanel");
        learningPanel.insertBefore(controls);

        if (typeOfProblem == 'flashcard' || typeOfProblem == 'fill_in_the_blank') {
            //create the model object
            var model = Model(learningPanel, vocab, flashcard_leftpos, flashcard_toppos);
            var map = model.getExerciseMap(model);
            var newCard = parseMap(map);
            $('input[autocomplete]').removeAttr('autocomplete');
            newCard.showExercise(map['native'], map['foreign']);
        }

        else if (typeOfProblem == 'how_to') {
            //create HowTo
            var ordered_box = Ordered_Box(eggGroup);
            var how_to = ordered_box.How_To(0, 0, learningPanel);
            how_to.showExercise();
        }
    }

    //Allows us to see when dom elements change, when initialized with arguments.
    //elem - element to observe changes in (note: this element should stay in the dom at all times, and this method
    //will monitor changes in it's child elements) If using a jQuery selector, be sure to call .get(0) on it.
    //listenattributes - boolean which determines if attributes of elements should be monitored as well.
    //callback - function the observer calls upon creation.
    function observeStateChange(elem, listenattributes, callback){
        MutationObserver = window.WebKitMutationObserver;

        var observer = new MutationObserver(function(mutations, observer) {
            // fired when a mutation occurs
            console.log(mutations, observer);
            callback(mutations);
        });

        // define what element should be observed by the observer
        // and what types of mutations trigger the callback
        observer.observe(elem, {
          subtree: true,
          childList: true,
          attributes: listenattributes,
        });

        return observer;
    }

    // listen for changes
    //.videoAdUiAttribution gives us the time remaining for the ad
    //className - STRING
    var flag = false;

    //className - STRING className to look for mutation in, which is what launches the program
    //(see first if statement in this function)
    var listenforAds = function(className){
        observeStateChange($('.ad-container').get(0), false, function(mutations){
            for(var i=0; i<mutations.length; ++i) {
                // look through all added nodes of this mutation
                for(var j=0; j<mutations[i].addedNodes.length; ++j) {
                    if ($('.' + className).length > 0 && flag == false) {
                        flag = true;
                        initializeProblems(); //TODO: add timeLeft as an argument by reading .videoAdUiAttribution
                    }

                    if(mutations[i].addedNodes[j].className == className && flag == false) {
                        flag = true;
                        initializeProblems(); //TODO: add timeLeft as an argument by reading .videoAdUiAttribution
                    }
                }

                for(var j = 0; j <mutations[i].removedNodes.length; ++j){
                    if(mutations[i].removedNodes[j].className==className){
                        $('#learningPanel').remove();
                    }
                }
            }
        });
    };
                			
    //DEBUG is initialized in the top of this doc. If true, learningPanel and exercises show up on all videos.
    //else, the program (should) act as normal, with exercises appearing over ads only.
    if (DEBUG) {
        initializeProblems();
    }
    else {
        //TODO: this class isn't correct. Try moving initializeProblems around the first two for loops in the listenforAds
        //method, and try using different classes. We had the best luck with this class, though the learningPanel
        //seems to duplicate itself ad infinitum :/
        listenforAds("videoAdUi");
    }

    // ------ other useful methods (currently these don't do anything) --------
    var videoElement = document.getElementsByClassName('video-stream')[0];

    videoElement.addEventListener("timeupdate", function () {
        var vTime = videoElement.currentTime;
        // console.log("current timestamp: " + vTime);
    }, false);


    videoElement.addEventListener("play",function(){
        //console.log("started playing!");
    });

    //----------------------------------------------------
});
