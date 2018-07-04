exports.action = function (data, callback) {

    var urlmarmiton = "http://www.marmiton.org";
    var searchReceipt = "/recettes/recherche.aspx?type=all&aqt=";
    var receipts = [];
    var valReceiptSearch = data.action.sentence;

    if (Config.modules.marmiton.nb_recettes == 0) {

        Avatar.speak("Je n'ai pas pu effectuer l'action. Veuillez vérifier le paramétrage du plugin.", data.client, function () {
            Avatar.Speech.end(data.client);
        });
    } else {
        var tblCommand = {

            error: function () {
                Avatar.speak(data.action.error, data.client, function () {
                    Avatar.Speech.end(data.client);
                });
            },
            recette: function () { marmitonPageRequest(urlmarmiton, searchReceipt, valReceiptSearch, receipts, data, callback) }
        };

        info("Marmiton command:", data.action.command.yellow, "From:", data.client.yellow);
        tblCommand[data.action.command]();

        callback();

    }
}


// Define request for the marmiton home page.
var marmitonPageRequest = function (urlmarmiton, searchReceipt, valReceiptSearch, receipts, data, callback) {
    var request = require('request'),
        cheerio = require('cheerio'),
        nomRecette = "",
        parle = "";

    request(urlmarmiton + searchReceipt + valReceiptSearch, function (error, response, html) {
        if (!error) {
            // Use Cheerio to load the page.
            var $ = cheerio.load(html);

            $('a.recipe-card', '.recipe-results').each(function () {
                var receipt = $(this), id, nameReceipt, url, notation, duration, receipt_url;
                if (receipts.length + 1 <= Config.modules.marmiton.nb_recettes) {
                    var id = receipts.length + 1;
                    var nameReceipt = $(this).find('.recipe-card .recipe-card__title').text();
                    var notation = $(this).find('.recipe-card .recipe-card__rating .recipe-card__rating__value').text();
                    var duration = $(this).find('.recipe-card .recipe-card__duration .recipe-card__duration__value').text();
                    var url = $(this).attr('href');
                    var receipt_url = /* urlmarmiton*/ url;
                    // Push the data into the search array.
                    receipts.push({ "id": id, "nameReceipt": nameReceipt, "notation": notation, "duration": duration, "receipt_url": receipt_url });
                    receipts.sort(sortArrayWithId);
                    if (!notation) { notation = "indefinie" }; if (!duration) { duration = "indefinie" };
                    parle += 'recette ' + id + ". " + nameReceipt + ' temps de praiparation ' + duration + ', note ' + notation + ". ";
                    nomRecette += nameReceipt + ":" + id ;
                }
            });

            Avatar.speak(parle, function () { poseQuestion(data, callback, nomRecette); });

        } else {
            console.log(error);
        }
        receiptPageRequest(receipts, callback, valReceiptSearch);
    });
}


// Define request for the marmiton receipt page.
var receiptPageRequest = function (receipts, callback, valReceiptSearch) {
    var request = require('request'),
        cheerio = require('cheerio'),
        async = require('async'),
        parle = " ";
    // For each of the receipt, execute the requests in parallel with async.
    async.each(receipts, function (receipt) {
        request(receipt.receipt_url, function (error, response, html) {
            if (!error) {

                //if (receipt.notation >= config.modules.marmiton.notation) {
                //  console.log('Scraper running on marmiton receipt page.');
                var $ = cheerio.load(html);
                // Scrape the ingredient info.
                var marmiton_receipt_name = $("meta[property='og:title']").attr("content");
                var marmiton_receipt_budget = $('.recipe-infos__budget').children('.recipe-infos__item-title').text();
                var marmiton_receipt_quantity_title = $('.recipe-infos__quantity').children('.recipe-infos__item-title').text();
                var marmiton_receipt_quantity = $("span[class='title-2 recipe-infos__quantity__value']").text();
                var marmiton_receipt_time_prep = $('.recipe-infos__timmings__preparation').children('.recipe-infos__timmings__value').text().trim();
                var marmiton_receipt_time_baking = $('.recipe-infos__timmings__cooking').children('.recipe-infos__timmings__value').text().trim();
                var marmiton_receipt_qt_ingredient = $('.recipe-ingredients__list').children('.recipe-ingredients__list__item').text().replace(/(\t\r\n|\n|\r|\t)/g, "");
                $('.recipe-preparation__list__item>h3.__secondary').remove();
                var marmiton_receipt_preparation = $('.recipe-preparation__list__item').text().toString().replace(/\t/g, '').split('\r\n');
                var index = receipts.indexOf(receipt);
                receipts[index] = receipt;
                //receipt.receipt_name = marmiton_receipt_name;
                receipt.receipt_budget = marmiton_receipt_budget;
                receipt.receipt_quantity_title = marmiton_receipt_quantity_title;
                receipt.receipt_quantity = marmiton_receipt_quantity;
                // Search Time value 
                receipt.receipt_time_prep = marmiton_receipt_time_prep;
                receipt.receipt_time_baking = marmiton_receipt_time_baking;
                // Search preparation / Ingredient list
                receipt.receipt_ingredient = marmiton_receipt_qt_ingredient;
                receipt.receipt_preparation = marmiton_receipt_preparation;
                // Tri croissant
                receipts.sort(sortArrayWithId);
                // Write file marmiton.json 
                var fs = require('fs');
                var fileJSON = __dirname + '/marmiton.json';
                fs.writeFileSync(fileJSON, JSON.stringify(receipts, null, 4), 'utf8');
            }
            else {
                console.log(error);
            }
        });

    }, function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log(null);
        }

    });
}

function sortArrayWithId(a, b) {
    if (a.Id < b.Id)
        return -1;
    if (a.Id > b.lId)
        return 1;
    return 0;
}

var readReceiptforJson = function (i) {
    var fs = require('fs');
    var fileJSON = __dirname + '/marmiton.json';

    fs.readFile(fileJSON, 'utf8', function (err, json) {
        if (err) { return console.log(err); }

        i = i - 1;
        jsonObj = JSON.parse(json);
        id = jsonObj[i].id;
        name = jsonObj[i].nameReceipt;
        quantity_title = jsonObj[i].receipt_quantity_title;
        quantity = jsonObj[i].receipt_quantity;
        time_prep = jsonObj[i].receipt_time_prep;
        time_baking = jsonObj[i].receipt_time_baking;
        ingredient = jsonObj[i].receipt_ingredient;
        preparation = jsonObj[i].receipt_preparation;

        parle = name + " pour " + quantity + " " + quantity_title + ", temps de préparation " + time_prep + ", temps de cuisson " + time_baking + ", liste des ingrédient " + ingredient + " praiparation " + preparation;
        Avatar.speak(parle, client, function () {
            Avatar.Speech.end(client);
        });
    });

}


var poseQuestion = function (data, callback, nomRecette) {
 
    askme_question = Config.modules.marmiton.askme_question;
    askme_answer = Config.modules.marmiton.askme_answer;
    client = data.client;
    Avatar.askme(askme_question, client, askme_answer, 0, function (answer, end) {

        if ((answer) && (answer != 0)) {
            end(client);
            readReceiptforJson(answer, function () {
            });
        }
        if (answer = "stop") Avatar.speak("D'accord...", data.client, function () {
            end(client);
        });
        if (answer > Config.modules.marmiton.nb_recettes) {
            Avatar.speak("Je ne peux pas énoncer cette recette.", data.client, function () {
                end(client);
            });
        }

        //if (answer = "stop") {
        //    Avatar.speak('d\'accord', client, function () {
        //        end(client, true);
        //    });
        //} else if (answer => 1 || answer <= Config.modules.marmiton.nb_recettes) {
        //    end(client);
        //    readReceiptforJson(answer, function () {});
        //} else {
        //        Avatar.speak("Je n'ai pas trouver cette recette.", data.client, function () {
        //        end(client);
        //    });
        //}
    });
}

