'use babel';

var _ = require('underscore');

import { CompositeDisposable } from 'atom';

var RenameDialog = require('./multifile-rename-dialog');

/**
 * Counts occurrences of 'letter' in 'string'.
 *
 * @param {string} string The string to search in.
 * @param {string} letter The character to count.
 * @returns {int}
 */
function countLetter(string, letter) {
  return ( string.match( RegExp(letter,'g') ) || [] ).length;
}

/**
 * Escapes RegEx literals in string.
 *
 * @param {string} string The string to escape in.
 * @returns {string}
 */
function escapeRegexChars(string) {
  return string.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&");
};

export default {

  modalPanel: null,
  subscriptions: null,
  selectedFiles: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'multifile-rename:toggle': () => this.toggle(),
    }));

    this.subscriptions.add(atom.commands.add('.tree-view .multi-select', {
      'multifile-rename:rename': () => this.rename(),
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {
    return {
    };
  },

  /**
   * Function for rename command.
   */
  rename() {
    this.placeholders = [];

    // create Rename Dialog
    this.dialog = new RenameDialog();

    var treeViewPackage = atom.packages.getActivePackage('tree-view'),
    selectedFilePaths;

    // Do nothing if the treeview does not exist
    if (treeViewPackage) {
      // get selected files
      selectedFilePaths = treeViewPackage.mainModule.treeView.selectedPaths();
      selectedFiles = [];

      _.each(selectedFilePaths, function(path) {
        var folders = path.split(/(\/|\\)/);
        var filename = folders.pop();
        selectedFiles.push({
          "path": folders.join(''),
          "name": filename
        });
      });

      var equalParts = this.findEqualParts(selectedFiles);

      var sameEndings = false;
      var lastEnding = "";
      for (var i = 0; i < selectedFiles.length; i++) {
        var name = selectedFiles[i].name;
        var currentEnding = name.substring(name.lastIndexOf("."), name.length);

        if (lastEnding != "") {
          sameEndings = (lastEnding == currentEnding);
          if (!sameEndings)
            break;
        }

        lastEnding = currentEnding;
      }

      var pattern = this.buildPattern(_.clone(equalParts));
      var placeholders = [];

      var regexPattern = _.clone(pattern);
      regexPattern = escapeRegexChars(regexPattern);
      regexPattern = regexPattern.replace(/\*/g, "\(\.\*\)");

      _.each(selectedFiles, function(file) {
        var results = new RegExp(regexPattern, 'g').exec(file.name);
        var placeholder = [];

        if (!_.isNull(results)) {
          for (var i = 1; i <= countLetter(pattern, '\\*'); i++) {
            if (i < results.length)
              placeholder.push(results[i]);
            else
              placeholder.push("");
          }
        } else {
          placeholder.push("");
        }

        file.placeholders = placeholder;
      });

      this.dialog.init(pattern, selectedFiles);
    }
  },

  /**
   * Gets equal name parts of selected files.
   *
   * @param {array} selectedFiles An array of selected files.
   * @returns {array}
   */
  findEqualParts(selectedFiles) {
    var commonPointCount = 0;
    var pointCounts = [];
    var equalParts = [];
    var files = _.clone(selectedFiles);

    _.each(files, function(file) {
      pointCounts.push(countLetter(file.name, "\\."));
    });

    commonPointCount = _.min(pointCounts);

    if (commonPointCount > 0) {
      for (var j = 0; j < commonPointCount; j++) {
        var equalCharsList = [];

        equalCharsList.push(this.findEqualChars(files, j, true));
        equalCharsList.push(this.findEqualChars(files, j, false));

        equalParts.push(equalCharsList);
      }
    }

    equalParts.push([this.findEqualChars(files, false, true), {"equal": ""}]);

    return equalParts;
  },

  /**
   * Gets equal chars of name parts of selected files.
   *
   * @param {array} selectedFiles An array of selected files.
   * @param {int} pointIndex Index of dot in file name. (Count direction rtl)
   * @param {boolean} searchDirectionLtr Search in ltr direction?
   * @returns {array}
   */
  findEqualChars(selectedFiles, pointIndex, searchDirectionLtr) {
    var equalChars = "";
    var continueLoop = true;
    var k = 0;
    var partLengths = [];

    while (continueLoop && k < 200) {
      var lastChar = "";

      for (var i = 0; i < selectedFiles.length; i++) {
        var nameParts = selectedFiles[i].name.split('.');
        var currentPart;
        var partsIndex = 0;

        if (_.isNumber(pointIndex))
          partsIndex = (nameParts.length - 1) - pointIndex;

        currentPart = nameParts[partsIndex];

        var charPosition = k;

        if (!searchDirectionLtr) {
          partsIndex = ((nameParts.length - 1) - pointIndex) - 1;
          currentPart = nameParts[partsIndex];
          charPosition = (currentPart.length - 1) - k;
        }

        partLengths.push(currentPart.length);

        var charIndex = 0;

        if (partsIndex != 0) {
          for (var a = 0; a < partsIndex; a++) {
            charIndex += nameParts[a].length;
            if (a == 0) {
              charIndex++;
            }
          }
        }
        charIndex += charPosition;

        if (_.isUndefined(selectedFiles[i].facedChars))
          selectedFiles[i].facedChars = [];

        if (_.contains(selectedFiles[i].facedChars, charIndex)) {
          continueLoop = false;
          break;
        }

        if (currentPart.length > k) {
          if (lastChar == "") {
              lastChar = currentPart.charAt(charPosition);
          } else {
            if (lastChar != currentPart.charAt(charPosition)) {
              continueLoop = false;
              break;
            }
          }
        } else {
          continueLoop = false;
          break;
        }

        selectedFiles[i].facedChars.push(charIndex);
      }

      if (continueLoop) {
        equalChars = equalChars + lastChar;
      }

      k++;
    }

    var commonPartLength = _.max(partLengths);
    var result;

    if (_.min(partLengths) != 0) {
      result = {
        'wholePart': (commonPartLength == equalChars.length),
        'equal': equalChars
      };
    } else {
      result = {
        'wholePart': false,
        'equal': ""
      };
    }

    if (!searchDirectionLtr)
      result.equal = equalChars.split("").reverse().join("");

    return result;
  },

  /**
   * Returns renaming pattern.
   *
   * @param {array} equalPartsReversed An array of equal parts in file names from star to end.
   * @returns {string}
   */
  buildPattern(equalPartsReversed) {
    var pattern = "";
    var equalParts = equalPartsReversed.reverse();

    for (var i = 0; i < equalParts.length; i++) {
      if (i > 0)
        pattern = pattern + ".";

      pattern = pattern + equalParts[i][0].equal;

      if (!equalParts[i][0].wholePart) {
        pattern = pattern + "*";
        if (i+1 < equalParts.length)
          pattern = pattern + equalParts[i+1][1].equal;
      }
    }

    return pattern;
  },

  toggle() {
    if (!_.isUndefined(this.dialog))
      this.dialog.close();
  }
};
