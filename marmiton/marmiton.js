exports.action = function (data, callback) {
    var urlmarmiton = "http://www.marmiton.org",
        searchReceipt = "/recettes/recherche.aspx?type=all&aqt=",
        receipts = [],
        valReceiptSearch = data.action.sentence,
        client = data.client;

    if (Config.modules.marmiton.nb_recettes == 0) {
        Avatar.speak("Je n'ai pas pu effectuer l'action. Veuillez vérifier le paramétrage du plugin.", client, function () {
            Avatar.Speech.end(client);
        });
    } else {
        var tblCommand = {
            recette: function () { marmitonPageRequest(urlmarmiton, searchReceipt, valReceiptSearch, receipts, client) },
            error: function () {
                Avatar.speak(data.action.error, client, function () {
                    Avatar.Speech.end(client);
                });
            }
        };

        info("Marmiton command:", data.action.command.yellow, "From:", client.yellow);
        tblCommand[data.action.command]();
    }
    callback();
}

// Define request for the marmiton home page.
var marmitonPageRequest = function (urlmarmiton, searchReceipt, valReceiptSearch, receipts, client) {
    var request = require('request'),
        cheerio = require('cheerio'),
        nomRecette = "",
        tts = '',
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
                    if ((notation > 0) && (notation >= Config.modules.marmiton.notation)) {
                        receipts.push({ "id": id, "nameReceipt": nameReceipt, "notation": notation, "duration": duration.replace(/min/i, 'minutes'), "receipt_url": receipt_url });
                        receipts.sort(sortArrayWithId);

                        parle += 'Recette ' + id + ". " + nameReceipt + ' temps de préparation : ' + duration.replace(/min/i, 'minutes') + ". ";

                    }
                }
            });
            info('ActionMarmiton'.bold.yellow, '\n' + parle.yellow);
           
            if (Config.modules.marmiton.nb_recettes == 1) {
                 tts = "J'ai trouvé " + Config.modules.marmiton.nb_recettes + " recette correspondante avec une notation égale ou supérieure à " + Config.modules.marmiton.notation + ". ";
            } else {
                tts = "J'ai trouvé " + Config.modules.marmiton.nb_recettes + " recettes correspondantes avec une notation égale ou supérieure à " + Config.modules.marmiton.notation + ". ";
            }
            Avatar.speak(tts + parle, client, function () { ask_recette(client); });

        } else {
            Avatar.speak("Une erreur s'est produite", client, function () {
                Avatar.Speech.end(client);
            });
        }
        receiptPageRequest(receipts, valReceiptSearch);
    });
}


// Define request for the marmiton receipt page.
var receiptPageRequest = function (receipts, valReceiptSearch) {
    var request = require('request'),
        cheerio = require('cheerio'),
        async = require('async'),
        parle = " ";

    // For each of the receipt, execute the requests in parallel with async.
    async.each(receipts, function (receipt) {
        request(receipt.receipt_url, function (error, response, html) {
            if (!error) {
                var $ = cheerio.load(html, {normalizeWhitespace: true, xmlMode: true});
                var marmiton_receipt_name = $("meta[property='og:title']").attr("content");
                var marmiton_receipt_budget = $('.recipe-infos__budget').children('.recipe-infos__item-title').text();
                var marmiton_receipt_quantity_title = $('.recipe-infos__quantity').children('.recipe-infos__item-title').text();
                var marmiton_receipt_quantity = $("span[class='title-2 recipe-infos__quantity__value']").text();
                var marmiton_receipt_time_prep = $('.recipe-infos__timmings__preparation').children('.recipe-infos__timmings__value').text().trim();
                var marmiton_receipt_time_baking = $('.recipe-infos__timmings__cooking').children('.recipe-infos__timmings__value').text().trim();

                var marmiton_receipt_list = "";   
                $(function () {
                    let ingredient = []; 
                    let ii = 0;
                    $(".recipe-ingredients__list .recipe-ingredients__list__item").each(
                        function () {
                            ingredient[ii] = ($(this).find('.recipe-ingredient-qt').text() + $(this).find('.ingredient').text()).replace(/\s{2,}/g, ' ');
                            ii++;
                        }
                    );
                    marmiton_receipt_list = ingredient.join(". ");
                });

                $('.recipe-preparation__list__item>h3.__secondary').remove();
                var marmiton_receipt_preparation = $('.recipe-preparation__list__item').text().toString().replace(/\s{2,}/g, ' '); 
                var index = receipts.indexOf(receipt);
                receipts[index] = receipt;
                //receipt.receipt_name = marmiton_receipt_name;
                receipt.receipt_budget = marmiton_receipt_budget;
                receipt.receipt_quantity_title = marmiton_receipt_quantity_title;
                receipt.receipt_quantity = marmiton_receipt_quantity;
                // Search Time value 
                receipt.receipt_time_prep = marmiton_receipt_time_prep.replace(/min/i, 'minutes');
                receipt.receipt_time_baking = marmiton_receipt_time_baking.replace(/min/i, 'minutes');
                // Search preparation / Ingredient list
                receipt.receipt_ingredient = marmiton_receipt_list;
                receipt.receipt_preparation = marmiton_receipt_preparation;
                // Tri croissant
                receipts.sort(sortArrayWithId);
                // Write file marmiton.json 
                var fs = require('fs');
                var fileJSON = __dirname + '/marmiton.json';
                fs.writeFileSync(fileJSON, JSON.stringify(receipts, null, 4), 'utf8');
            }
            else {
                Avatar.Speech.end(data.client);
            }
        });

    }, function (err) {
        if (err) { 
            
            Avatar.Speech.end(data.client);
        } else {
            
            Avatar.Speech.end(data.client);
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

var readReceiptforJson = function (answer, client) {
    var fs = require('fs');
    var fileJSON = __dirname + '/marmiton.json';
    var info_recette = [];

    fs.readFile(fileJSON, 'utf8', function (err, jsonrecette) {
        if (err) { return console.log(err); }

        answer = answer - 1;
        jsonObj = JSON.parse(jsonrecette); 
        id = jsonObj[answer].id;
        name = jsonObj[answer].nameReceipt;
        quantity_title = jsonObj[answer].receipt_quantity_title;
        quantity = jsonObj[answer].receipt_quantity;
        time_prep = jsonObj[answer].receipt_time_prep;
        time_baking = jsonObj[answer].receipt_time_baking;
        ingredient = jsonObj[answer].receipt_ingredient;
        preparation = jsonObj[answer].receipt_preparation;

        recette = name + " pour " + quantity + " " + quantity_title + ". temps de préparation " + time_prep + ". temps de cuisson " + time_baking + ". liste des ingrédients " + ingredient + ". préparation " + preparation;

        info_recette = {
            name: name,
            quantity: quantity,
            quantity_title: quantity_title,
            time_prep: time_prep,
            time_baking: time_baking,
            ingredient: ingredient,
            preparation: preparation
        }

        info('ActionMarmiton'.bold.yellow, '\nRecette : ' + name.yellow + '\nPour : ' + quantity.yellow + ' ' + quantity_title.yellow + "\nTemps de préparation : " + time_prep.yellow + "\nTemps de cuisson : " + time_baking.yellow + "\nIngrédients : " + ingredient.yellow + "\nPréparation : " + preparation.yellow);
        Avatar.speak(recette, client, function () { 
            Avatar.Speech.end(client);
            ask_etapes_recette(info_recette, client, true);
        });
    });
}


var ask_recette = function (client) {
 
    var askme_question = Config.modules.marmiton.askme_question;
    var num_recette = Config.modules.marmiton.num_recette;

        Avatar.askme(askme_question, client, num_recette, 0, function (answer, end) {

        if (answer >= 1) {
            end(client, true);
            readReceiptforJson(answer, client);
        }
        else if (answer = "close") Avatar.speak("j'ai quitter marmiton", client, function () {
                 end(client, true);
        });
        else if (answer > Config.modules.marmiton.nb_recettes) {
            Avatar.speak("Je ne peux pas énoncer cette recette.", client, function () {
                end(client, true);
            });
        }
    });
}

ask_etapes_recette = function (info_recette, client, callback) {

    if (!callback) return;
    tts = "";
    var etape_question = Config.modules.marmiton.etape_question;
    var etapes = Config.modules.marmiton.etapes;

    Avatar.askme(etape_question, client, etapes, 0, function (answer, end) {

        switch (answer) {
            case 'list_ingredient':
                info('ActionMarmiton'.bold.yellow, 'Recette : ' + info_recette.ingredient.yellow);
                Avatar.speak("Ingrédients : " + info_recette.ingredient, client, function () {
                    end(client);
                    ask_etapes_recette(info_recette, client, true);
                });
                break;
            case 'preparation':
                info('ActionMarmiton'.bold.yellow, 'Recette : ' + info_recette.preparation.yellow);
                Avatar.speak("Préparation : " + info_recette.preparation, client, function () {
                    end(client);
                    ask_etapes_recette(info_recette, client, true);
                });
                break;
            case 'cancel':
                Avatar.speak ("J'ai quitté marmiton", client, function () {
                    end(client, true);
                });
                break;
            default:
                Avatar.speak(tts, client, function () {
                    end(client, true);
                });
                break;
        }
    });
}
