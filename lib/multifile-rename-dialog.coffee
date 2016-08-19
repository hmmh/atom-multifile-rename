{$, TextEditorView, SelectListView, View} = require 'atom-space-pen-views'

path = require 'path'
_ = require 'underscore'
fs = require 'fs-plus'

module.exports =
class Dialog extends View
  @content: ->
    @div class: 'multifile-rename', =>
      @div 'Enter the new name for the files.'
      @subview 'patternEditor', new TextEditorView(mini: true)
      @div class: 'horizontal', =>
        @div class: 'left', =>
          @div 'Original:'
          @ul class: 'list-group', outlet: 'oldNamesList'
        @div class: 'right', =>
          @div 'After:'
          @ul class: 'list-group', outlet: 'newNamesList'

  initialize: () ->
    @selectedFiles = []
    # @patternEditor.on 'blur', => @close() if document.hasFocus()
    atom.commands.add @element,
      'core:confirm': => @onConfirm(@patternEditor.getText())
      'core:cancel': => @cancel()
    @patternEditor.getModel().onDidChange => @updatePreviewList(@patternEditor.getText())

  init: (pattern, selectedFiles) ->
    @panel = atom.workspace.addModalPanel(item: this.element)
    @selectedFiles = selectedFiles
    @patternEditor.setText(pattern)
    @patternEditor.focus()
    _.each @selectedFiles, ((file) ->
      @oldNamesList.append('<li>' + file.name + '</li>')
    ), this
    @updatePreviewList(pattern)
    @panel.show()

  countLetter: (string, letter) ->
    (string.match(RegExp(letter, 'g')) or []).length

  getNewName: (pattern, file) ->
    patternParts = pattern.split '*'
    result = ""
    if this.countLetter(pattern, '\\*') != 0
      for i in [0..this.countLetter(pattern, '\\*')-1]
        result = result + patternParts[i]
        if i < file.placeholders.length
          result = result + file.placeholders[i]
      result + patternParts[patternParts.length-1]
    else
      file.name

  updatePreviewList: (pattern) ->
    @newNamesList.empty()
    _.each @selectedFiles, ((file) ->
      @newNamesList.append('<li>' + @getNewName(pattern, file) + '</li>')
    ), this

  onConfirm: (pattern) ->
    i = 0
    while i < @selectedFiles.length
      file = @selectedFiles[i]

      @selectedFiles[i].newName = @getNewName(pattern, file)
      if fs.isFileSync(@selectedFiles[i].path+'/'+@selectedFiles[i].name)
        fs.moveSync(@selectedFiles[i].path+'/'+@selectedFiles[i].name, @selectedFiles[i].path+'/'+@selectedFiles[i].newName)
      i++

    @close()

  close: ->
    panelToDestroy = @panel
    @panel = null
    panelToDestroy?.destroy()
    atom.workspace.getActivePane().activate()

  removeIlligalChars: (string) ->
    string.replace(/[|&;$%@'<>()+,\/]/g, '')

  cancel: ->
    @close()
    $('.tree-view').focus()