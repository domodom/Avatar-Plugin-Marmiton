/* **********************************************************
 * Plugin marmiton pour Avatar.IA
 * Recherche sur marmiton la recette demandée
 * Eddy TELLIER
 * Release Version : 1.0.0
 * Date Release : 23/08/2018
 * Version : 1.2.0
 ************************************************************
 */

var request = require('request'),
    cheerio = require('cheerio'),
    async = require('async'),
    fs = require('fs'),
    fileJSON = __dirname + '/marmiton.json',
    receipts = [],
    valReceiptSearch,
    debug;
require('colors');

exports.init = function () {
    debug = Config.modules.marmiton.debug;
};

exports.action = function (data, callback) {
    let api_search_marmiton = "http://www.marmiton.org/recettes/recherche.aspx?type=all&aqt=",
        client = data.client;
        valReceiptSearch = data.action.sentence;

    if (Config.modules.marmiton.nb_recettes == 0) {
        Avatar.speak("Je n'ai pas pu effectuer l'action. Veuillez vérifier le paramétrage du plugin.", client, function () {
            Avatar.Speech.end(client);
        });
    } else {
        let tblCommand = {
            recette: function () {
                Avatar.speak('Un instant, Je lance la recherche...' , client, function () {
                    Avatar.Speech.end(client);
                    marmitonPageRequest(api_search_marmiton, valReceiptSearch, receipts, client)
                });
            },
            error: function () {
                Avatar.speak(data.action.error, client, function () {
                    Avatar.Speech.end(client);
                });
            }
        };
        info("Marmiton v " + Config.modules.marmiton.version, data.action.command.yellow, "From:", client.yellow);
        tblCommand[data.action.command]();
    }
    callback();
};

var marmitonPageRequest = function (api_search_marmiton, valReceiptSearch, receipts, client) {
    request(api_search_marmiton + valReceiptSearch, function (error, response, html) {
        if (!error) {
            var $ = cheerio.load(html);

            $('.recipe-card', '.recipe-results').each(function () {

                var receipt = $(this), id, nameReceipt, url, notation, duration, receipt_url;
                if (receipts.length + 1 <= Config.modules.marmiton.nb_recettes) {
                    let id = receipts.length + 1;
                    let nameReceipt = $(this).find('.recipe-card .recipe-card__title').text();
                    let notation = $(this).find('.recipe-card .recipe-card__rating .recipe-card__rating__value').text().trim();
                    let duration = $(this).find('.recipe-card .recipe-card__duration .recipe-card__duration__value').text();
                    let receipt_url = $(this).find('.recipe-card a.recipe-card-link').attr('href');

                    if ((notation > 0) && (notation >= Config.modules.marmiton.notation)) {
                        receipts.push({
                            "id": id,
                            "nameReceipt": nameReceipt,
                            "notation": notation,
                            "duration": duration.yellow.replace(/min/i, 'minutes'),
                            "receipt_url": receipt_url
                        });
                        receipts.sort(sortArrayWithId);
                    }
                }
            });
        }
        else {
            Avatar.speak("Une erreur s'est produite", client, function () {
                Avatar.Speech.end(client);
            });
        }
        receiptPageRequest(receipts, valReceiptSearch, client);
    });
    Avatar.Speech.end(client);
};


var receiptPageRequest = function (receipts, valReceiptSearch, client) {

    async.each(receipts, function (receipt) {
        request(receipt.receipt_url, function (error, response, html) {
            if (!error) {
                let $ = cheerio.load(html, {normalizeWhitespace: true, xmlMode: true});
                let marmiton_receipt_name = $("meta[property='og:title']").attr("content");
                let marmiton_receipt_budget = $('.recipe-infos__budget').children('.recipe-infos__item-title').text();
                let marmiton_receipt_quantity_title = $('.recipe-infos__quantity').children('.recipe-infos__item-title').text();
                let marmiton_receipt_quantity = $("span[class='title-2 recipe-infos__quantity__value']").text();
                let marmiton_receipt_time_prep = $('.recipe-infos__timmings__preparation').children('.recipe-infos__timmings__value').text().trim();
                let marmiton_receipt_time_baking = $('.recipe-infos__timmings__cooking').children('.recipe-infos__timmings__value').text().trim();
                let marmiton_receipt_list = "";
                let marmiton_ingredient = [];
                let ingredient = [];
                $(function () {
                    let ii = 0;
                    $(".recipe-ingredients__list .recipe-ingredients__list__item").each(
                        function () {
                            ingredient[ii] = ($(this).find('.recipe-ingredient-qt').text() + $(this).find('.ingredient').text()).replace(/\s{2,}/g, ' ');
                            ii++;
                        }
                    );
                    marmiton_receipt_list = ingredient.join(". ");
                });
                let marmiton_receipt_preparation = $('.recipe-preparation__list__item').text().toString().replace(/\s{2,}/g, ' ').split('Etape ').slice(1);

                let index = receipts.indexOf(receipt);
                receipts[index] = receipt;
                receipt.receipt_budget = marmiton_receipt_budget;
                receipt.receipt_quantity_title = marmiton_receipt_quantity_title;
                receipt.receipt_quantity = marmiton_receipt_quantity;
                receipt.receipt_time_prep = marmiton_receipt_time_prep.replace(/min/i, 'minutes');
                receipt.receipt_time_baking = marmiton_receipt_time_baking.replace(/min/i, 'minutes');
                receipt.receipt_ingredient = marmiton_receipt_list;
                receipt.receipt_preparation = marmiton_receipt_preparation;
                receipts.sort(sortArrayWithId);
            }
            else {
                Avatar.Speech.end(client);
            }
        });

    }, function (err) {
        if (err) {
            Avatar.Speech.end(client);
        } else {
            Avatar.Speech.end(client);
        }
    });
    Avatar.speak('J\'ai trouvé ' + receipts.length + ' recettes correspondantes à la recherche ' + valReceiptSearch, client, function () {
        Avatar.Speech.end(client);
        setTimeout(function () {
            readReceiptforJson('', 0, client);
        }, 500);
    });

};

var readReceiptforJson = function (tts, pos, client) {
    let info_recette = [];
        if (pos + 1 > Config.modules.marmiton.nb_recettes) { pos = 0 }

        let id = receipts[pos].id;
        let name = receipts[pos].nameReceipt;
        let notation = receipts[pos].notation;
        let budget = receipts[pos].receipt_budget;
        let quantity_title = receipts[pos].receipt_quantity_title;
        let quantity = receipts[pos].receipt_quantity;
        let time_prep = receipts[pos].receipt_time_prep;
        let time_baking = receipts[pos].receipt_time_baking;
        let ingredient = receipts[pos].receipt_ingredient;
        let preparation = receipts[pos].receipt_preparation;

        tts = "Recette " + id + ". " + name + " pour " + quantity + " " + quantity_title + " note " + notation + ", " + budget;
        info_recette = {
            name: name,
            notation: notation,
            budget: budget,
            quantity: quantity,
            quantity_title: quantity_title,
            time_prep: time_prep,
            time_baking: time_baking,
            ingredient: ingredient,
            preparation: preparation
        };

        Avatar.askme(tts, client,
            Config.modules.marmiton.ask_recette
            , 0, function (answer, end) {
                switch (answer) {
                    case 'sommaire':
                        end(client);
                        Avatar.speak(Config.modules.tts_recette, client, function () {
                            Avatar.Speech.end(client);
                        });
                        break;
                    case 'previous':
                        end(client);
                        if (pos + 1 <= Config.modules.marmiton.nb_recettes) {
                            readReceiptforJson(tts, --pos, client);
                        }
                        break;
                    case 'next':
                        end(client);
                        if (pos + 1 <= Config.modules.marmiton.nb_recettes) {
                            readReceiptforJson(tts, ++pos, client);
                        }
                        break;
                    case 'select':
                        end(client);
                        if (pos + 1 <= Config.modules.marmiton.nb_recettes) {
                            ask_etapes_recette(info_recette.name + " pour " + info_recette.quantity + " " + info_recette.quantity_title + " " + budget + ". " + Config.modules.marmiton.tts_etape_recette, 0, info_recette, client);
                        }
                        break;
                    case 'again':
                        end(client);
                        readReceiptforJson(tts, pos, client);
                        break;
                    case 'done':
                        Avatar.speak('J\'ai quitté marmiton !', client, function () {
                            Avatar.Speech.end(client);
                        });
                        break;
                    default:
                            end(client);
                        break;
                }
        });
};

var ask_etapes_recette = function (tts, nb_quantity, info_recette, client) {
    Avatar.askme(
        tts,
        client,
        Config.modules.marmiton.liste_etapes,
        0, function (answer, end) {
            switch (answer) {
                case 'sommaire':
                    end(client);
                    Avatar.speak(Config.modules.marmiton.tts_etape_recette, client, function () {
                        Avatar.Speech.end(client);
                    });
                    break;
                case 'list_ingredient':
                    end(client);
                    if (nb_quantity == 0 || nb_quantity == "undefined") {
                        ask_nb_quantity(info_recette, client);
                    }
                    else {
                        let ing_nb = info_recette.ingredient.replace(/\d+/g, el => el > 1 ? (el / info_recette.quantity).toFixed(1) * nb_quantity : el);
                        if (debug) info('Ingrédients pour ' + nb_quantity + ' ' + info_recette.quantity_title + " : " + ing_nb);
                        ask_etapes_recette(ing_nb, nb_quantity, info_recette, client);
                    }
                    break;
                case 'preparation':
                    end(client);
                    ask_etapes_recette_prep(0, info_recette, client);
                    break;
                case 'back_recette':
                    end(client);
                    readReceiptforJson('', 0, client);
                    break;
                case 'done':
                    end(client);
                    Avatar.speak("J'ai quitté marmiton !", client, function () {
                        Avatar.Speech.end(client);
                    });
                    break;
                default:
                        end(client);
                    break;
            }
        });
};

var ask_etapes_recette_prep = function (etape_prep, info_recette, client) {
    if (etape_prep >= info_recette.preparation.length) {
        etape_prep = 0;
        Avatar.speak("Retour à l'étape une.", client, function () {
            Avatar.Speech.end(client);
        });
    }
    if (debug) info('Préparation : ' + info_recette.preparation[etape_prep]);
    Avatar.askme(
        "Etape " + info_recette.preparation[etape_prep],
        client,
        Config.modules.marmiton.liste_etapes_prep,
        0, function (answer, end) {
            switch (answer) {
                case 'sommaire':
                    end(client);
                    Avatar.speak(Config.modules.marmiton.tts_etape_recette_prep, client, function () {
                        Avatar.Speech.end(client);
                        ask_etapes_recette_prep(etape_prep, info_recette, client);
                    });
                    break;
                case 'next':
                    end(client);
                    ask_etapes_recette_prep(++etape_prep, info_recette, client);
                    break;
                case 'repeat':
                    end(client);
                    ask_etapes_recette_prep(etape_prep, info_recette, client);
                    break;
                case 'previous':
                    end(client);
                    ask_etapes_recette_prep(--etape_prep, info_recette, client);
                    break;
                case 'back_recette':
                    end(client);
                    ask_etapes_recette(info_recette.name, 0, info_recette, client);
                    break;
                case 'done':
                    end(client);
                    Avatar.speak("J'ai quitté marmiton !", client, function () {
                        Avatar.Speech.end(client);
                    });
                    break;
                default:
                    end(client);
                    ask_etapes_recette_prep(etape_prep, info_recette, client);
                    break;
            }
        });
};

var ask_nb_quantity = function (info_recette, client) {
    let nb_quantity;
    Avatar.askme("Pour combien de " + info_recette.quantity_title + " souhaites-tu avoir la liste des ingrédients ?", client,
        {
            "*": "nb_quantity",
            "retour": "back",
            "retour aux recettes": "back",
            "quitter": "done"
        }, 0, function (answer, end) {
            end(client);
            if (!answer) ask_nb_quantity(info_recette, client);
            if (answer.indexOf('nb_quantity') != -1) {
                let r = /\d+/g;
                let ing;
                nb_quantity = answer.match(r);
                if (debug) info('Recette pour ' + nb_quantity + " " + info_recette.quantity_title);
                let ing_nb = info_recette.ingredient.replace(/\d+/g, el => el > 1 ? (el / info_recette.quantity) * nb_quantity : el);
                if (debug) info('Ingrédients pour ' + nb_quantity + info_recette.quantity_title + " : " + ing_nb);
                Avatar.speak(info_recette.name + ' pour ' + nb_quantity + info_recette.quantity_title + ". " + ing_nb, client, function () {
                    Avatar.Speech.end(client);
                    ask_etapes_recette(info_recette.name + ". " + Config.modules.marmiton.tts_etape_recette, nb_quantity, info_recette, client);
                });
            }
            if (answer.indexOf('back') != -1) {
                readReceiptforJson('', 0, client);
            }

            if (answer.indexOf('done') != -1) {
                Avatar.speak('J\'ai quitter marmiton', client, function () {
                    Avatar.Speech.end(client);
                });
            }
        });
};

var sortArrayWithId = function (a, b) {
    if (a.Id < b.Id)
        return -1;
    if (a.Id > b.lId)
        return 1;
    return 0;
};

var setClient = function (data) {
    // client direct (la commande provient du client et est exécutée sur le client)
    var client = data.client;
    // Client spécifique fixe (la commande ne provient pas du client et n'est pas exécutée sur le client et ne peut pas changer)
    if (data.action.room)
        client = (data.action.room != 'current') ? data.action.room : (Avatar.currentRoom) ? Avatar.currentRoom : Config.default.client;
    // Client spécifique non fixe dans la commande HTTP (la commande ne provient pas du client et n'est pas exécutée sur le client et peut changer)
    if (data.action.setRoom)
        client = data.action.setRoom;
    return client;
};