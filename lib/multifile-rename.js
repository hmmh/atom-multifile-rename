'use babel';

var _ = require('underscore');

import MultifileRenameView from './multifile-rename-view';
import { CompositeDisposable } from 'atom';

var RenameDialog = require('./multifile-rename-dialog');

function countLetter(string, letter) {
  return ( string.match( RegExp(letter,'g') ) || [] ).length;
}

export default {

  multifileRenameView: null,
  modalPanel: null,
  subscriptions: null,
  selectedFiles: null,

  activate(state) {
    this.multifileRenameView = new MultifileRenameView(state.multifileRenameViewState);

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'multifile-rename:toggle': () => this.toggle(),
    }));

    this.subscriptions.add(atom.commands.add('.tree-view.multi-select', {
      'multifile-rename:rename': () => this.rename(),
    }));
  },

  deactivate() {
    // this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.multifileRenameView.destroy();
  },

  serialize() {
    return {
      multifileRenameViewState: this.multifileRenameView.serialize()
    };
  },

  rename(target) {
    this.placeholders = [];
    this.dialog = new RenameDialog();

    var treeViewPackage = atom.packages.getActivePackage('tree-view'),
    selectedFilePaths;

    // Do nothing if the treeview does not exist
    if (treeViewPackage) {
      selectedFilePaths = treeViewPackage.mainModule.treeView.selectedPaths();
      selectedFiles = [];

      _.each(selectedFilePaths, function(path) {
        var folders = path.split("/");
        selectedFiles.push({
          "path": path.substring(0, path.lastIndexOf("/")),
          "name": folders[folders.length-1]
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

console.log(equalParts);
      var pattern = this.buildPattern(_.clone(equalParts));
      console.log(pattern);
      var placeholders = [];

      _.each(selectedFiles, function(file) {
        var regexPattern = _.clone(pattern);
        regexPattern = regexPattern.replace(/\./g, '\\.');
        regexPattern = regexPattern.replace(/\*/g, "\(\.\*\)");

        var results = new RegExp(regexPattern, 'g').exec(file.name);
        console.log(results);

        var placeholder = [];
        for (var i = 1; i <= countLetter(pattern, '\\*'); i++) {
          if (i < results.length)
            placeholder.push(results[i]);
          else
            placeholder.push("");
        }
        file.placeholders = placeholder;
      });

      // var pattern = equalChars + "*" + ((sameEndings) ? lastEnding : ".*");

      this.dialog.init(pattern, selectedFiles);
    }
  },

  findEqualParts(selectedFiles) {
    var commonPointCount = 0;
    var pointCounts = [];
    var equalParts = [];


    _.each(selectedFiles, function(file) {
      pointCounts.push(countLetter(file.name, "\\."));
    });

    commonPointCount = _.min(pointCounts);

    if (commonPointCount > 0) {
      for (var j = 0; j < commonPointCount; j++) {
        var equalCharsList = [];

        equalCharsList.push(this.findEqualChars(selectedFiles, j, true));
        equalCharsList.push(this.findEqualChars(selectedFiles, j, false));

        equalParts.push(equalCharsList);
      }
    }

    equalParts.push([this.findEqualChars(selectedFiles, false, true), {"equal": ""}]);

    return equalParts;
  },

  findEqualChars(selectedFiles, pointCount, searchDirectionLtr) {
    var equalChars = "";
    var continueLoop = true;
    var k = 0;
    var partLengths = [];

    while (continueLoop && k < 200) {
      var lastChar = "";

      for (var i = 0; i < selectedFiles.length; i++) {
        var nameParts = selectedFiles[i].name.split('.');
        var currentPart;

        if (_.isNumber(pointCount)) {
          currentPart = nameParts[(nameParts.length - 1) - pointCount];
        } else {
          currentPart = nameParts[0];
        }

        var charPosition = k;

        if (!searchDirectionLtr) {
          currentPart = nameParts[((nameParts.length - 1) - pointCount) - 1];
          charPosition = (currentPart.length - 1) - k;
        }

        partLengths.push(currentPart.length);

        if (currentPart.length > k) {
          if (lastChar == "")
            lastChar = currentPart.charAt(charPosition);
          else {
            if (lastChar != currentPart.charAt(charPosition)) {
              continueLoop = false;
              break;
            }
          }
        } else {
          continueLoop = false;
          break;
        }
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

  // builPlaceholder(selectedFiles, pointCount, equalChars, directionLtr) {
  //   var placeholder = [];
  //
  //   _.each(selectedFiles, function(file) {
  //     var nameParts = file.name.split('.');
  //     var currentPart;
  //
  //     if (_.isNumber(pointCount)) {
  //       currentPart = nameParts[(nameParts.length - 1) - pointCount];
  //     } else {
  //       currentPart = nameParts[0];
  //     }
  //
  //     var charPosition = equalChars.length;
  //
  //     if (!directionLtr) {
  //       currentPart = nameParts[((nameParts.length - 1) - pointCount) - 1];
  //       // charPosition = (currentPart.length - 1) - k;
  //     }
  //
  //     if (currentPart.length > charPosition) {
  //       if (directionLtr) {
  //         placeholder.push(currentPart.substring(charPosition, currentPart.length));
  //       } else
  //         placeholder.push(currentPart.substring(0, currentPart.length-charPosition));
  //     } else
  //       placeholder.push("");
  //   });
  //
  //   console.log(placeholder);
  // },

  toggle() {
    if (!_.isUndefined(this.dialog))
      this.dialog.close();
  }

};
