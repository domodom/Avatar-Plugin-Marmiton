'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _ = require('underscore');

// Ignoré une fois dans TERM
var TERM = ['marmiton', 'recherche', 'cherche', 'la', 'qu\'est-ce', 'le', 'les', 'des', 'de', 'du', 'sur', 'ce', 'que', 'qui', 'recette', 'c\'est', 'est', 'sur', 's\'il', 'te', 'plaît', 'plait'];
// Toujours ignoré dans NOTERM
var NOTERM = ['la', 'ce', 'que', 'qu\'est-ce', 'qui', 'recette', 'savoir', 'pour', 'c\'est', 'est', 's\'il', 'te', 'plaît', 'plait'];
// Non ignoré si un term est déjà pris, ex: la défintion de la revue du cinéma
var IGNORETERM = ['aux', 'du', 'de', 'des'];


exports.default = function (state) {

    return new Promise(function (resolve, reject) {

        var TAKEN = [];
        for (var i in TERM) {
            TAKEN.push(0);
        }

        var sentence = '';
        var indexMarmiton, pos, take;
        var terms = state.rawSentence.split(' ');
        terms.map(function (term, index) {

            if (!indexMarmiton && term.toLowerCase() === 'marmiton') indexMarmiton = true;

            if (indexMarmiton) {
                take = false;
                pos = _.indexOf(TERM, term.toLowerCase());
                if (pos != -1) {
                    if (TAKEN[pos] == 0) {
                        if (sentence && sentence.length > 0 && _.indexOf(IGNORETERM, term.toLowerCase()) != -1) {
                            take = true;
                        } else {
                            TAKEN[pos] = 1;
                        }
                    } else {
                        if (_.indexOf(NOTERM, term.toLowerCase()) == -1)
                            take = true;
                    }
                } else {
                    take = true;
                }
                if (take) {
                    sentence += term;
                    if (terms[index + 1]) sentence += ' ';
                }
            }
        });

        // test si on a récupéré quelque chose
        if (sentence) {
            sentence = sentence.replace('l\'', '');
            sentence = sentence.sansAccent();
            sentence = sentence.replace(sentence[0], sentence[0].toUpperCase());

            // Affiche ce qui doit être recherché
            if (state.debug) info('ActionMarmiton'.bold.yellow, 'sentence:'.bold, sentence);

                // Envoi au plugin
                setTimeout(function () {
                    state.action = {
                        module: 'marmiton',
                        command: 'recette',
                        sentence: sentence
                    };

                    resolve(state);
                }, 500);

        } else {
            setTimeout(function () {
                // Envoi au plugin l'erreur
                state.action = {
                    module: 'marmiton',
                    command: 'error',
                    error: 'je suis désolé, je n\'ai pas compris la recette qu\'il faut que je recherche'
                };
                resolve(state);
            }, 500);
        }
    });
};

String.prototype.sansAccent = function () {
    var accent = [
        /[\300-\306]/g, /[\340-\346]/g, // A, a
        /[\310-\313]/g, /[\350-\353]/g, // E, e
        /[\314-\317]/g, /[\354-\357]/g, // I, i
        /[\322-\330]/g, /[\362-\370]/g, // O, o
        /[\331-\334]/g, /[\371-\374]/g, // U, u
        /[\321]/g, /[\361]/g, // N, n
        /[\307]/g, /[\347]/g, // C, c
    ];
    var noaccent = ['A', 'a', 'E', 'e', 'I', 'i', 'O', 'o', 'U', 'u', 'N', 'n', 'C', 'c'];

    var str = this;
    for (var i = 0; i < accent.length; i++) {
        str = str.replace(accent[i], noaccent[i]);
    }

    return str;
}