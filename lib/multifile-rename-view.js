'use babel';

export default class MultifileRenameView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('multifile-rename');
    this.element.innerHTML = '<label class="icon icon-arrow-right">Enter the new name for the files.</label><atom-text-editor class="editor mini" tabindex="-1" mini="" data-grammar="text plain null-grammar" data-encoding="utf8"></atom-text-editor> <div class="error-message"></div>';
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  getEditorElement() {
    var input = this.element.getElementsByClassName("editor");
    return (
      input[0]
    );
  }

  init(pattern) {
    var input = this.element.getElementsByClassName("editor");
    this.editor = input[0].component.editor;
    this.editor.setText(pattern);
    input[0].component.focused();
  }

  cancel() {
    this.editor.setText("");
  }

  getPattern() {
    return (
      this.editor.getText()
    );
  }
}