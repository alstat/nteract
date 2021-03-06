// @flow
/* eslint-disable class-methods-use-this */
import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';
import Rx from 'rxjs/Rx';
import CodeMirror from 'react-codemirror';
import CM from 'codemirror';
import { Map as ImmutableMap } from 'immutable';

import {
  transforms
} from '@nteract/transforms';

import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/anyword-hint';
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/comment/comment.js';
import 'codemirror/mode/python/python';
import 'codemirror/mode/ruby/ruby';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/julia/julia';
import 'codemirror/mode/r/r';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/shell/shell';
import 'codemirror/mode/sql/sql';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/mode/gfm/gfm';

import './codemirror-ipython';
import excludedIntelliSenseTriggerKeys from './excludedIntelliSenseKeys';
import { codeComplete, pick } from './complete';
import { tool } from './tooltip';

type WrapperProps = {
  id: string,
  input: any,
  editorFocused: boolean,
  cellFocused: boolean,
  completion: boolean,
  tip: boolean,
  focusAbove: () => void,
  focusBelow: () => void,
  theme: string,
  channels: any,
  cursorBlinkRate: number,
  executionState: "idle" | "starting" | "not connected",
  language: string,
  onChange: (text: string) => void,
  onFocusChange: (focused: boolean) => void
};

type FunctionalComponent<P> = (props: P) => React.Element<*>;
type ClassComponent<P> = Class<React.Component<void, P, void>>;

type CodeMirrorHOC = (
  E: ClassComponent<*> | FunctionalComponent<*>,
  C?: { [key: string]: any } | null
) => ClassComponent<WrapperProps>;

const CodeMirrorWrapper: CodeMirrorHOC = (EditorView, customOptions = null) =>
  class CodeMirrorEditor extends PureComponent<void, WrapperProps, void> {
    codemirror: Object;
    getCodeMirrorOptions: (p: WrapperProps) => Object;
    goLineUpOrEmit: (editor: Object) => void;
    goLineDownOrEmit: (editor: Object) => void;
    executeTab: (editor: Object) => void;
    hint: (editor: Object, cb: Function) => void;
    tips: (editor: Object) => void;

    constructor(): void {
      super();

      this.hint = this.completions.bind(this);
      this.tips = this.tips.bind(this);
      this.hint.async = true;
    }

    componentDidMount(): void {
      const {
        editorFocused,
        executionState,
        focusAbove,
        focusBelow
      } = this.props;
      const cm = this.codemirror.getCodeMirror();

      // On first load, if focused, set codemirror to focus
      if (editorFocused) {
        this.codemirror.focus();
      }

      cm.on("topBoundary", focusAbove);
      cm.on("bottomBoundary", focusBelow);

      const keyupEvents = Rx.Observable.fromEvent(
        cm,
        "keyup",
        (editor, ev) => ({ editor, ev })
      );

      keyupEvents.switchMap(i => Rx.Observable.of(i)).subscribe(({
        editor,
        ev
      }) => {
        const cursor = editor.getDoc().getCursor();
        const token = editor.getTokenAt(cursor);

        if (
          !editor.state.completionActive &&
          !excludedIntelliSenseTriggerKeys[
            (ev.keyCode || ev.which).toString()
          ] &&
          (token.type === "tag" ||
            token.type === "variable" ||
            token.string === " " ||
            token.string === "<" ||
            token.string === "/") &&
          executionState === "idle"
        ) {
          editor.execCommand("autocomplete", { completeSingle: false });
        }
      });
    }

    componentDidUpdate(prevProps: WrapperProps): void {
      const cm = this.codemirror.getCodeMirror();
      const { cursorBlinkRate, editorFocused, theme } = this.props;

      if (prevProps.theme !== theme) {
        cm.refresh();
      }

      if (prevProps.editorFocused !== editorFocused) {
        editorFocused ? this.codemirror.focus() : cm.getInputField().blur();
      }

      if (prevProps.cursorBlinkRate !== cursorBlinkRate) {
        cm.setOption("cursorBlinkRate", cursorBlinkRate);
        if (editorFocused) {
          // code mirror doesn't change the blink rate immediately, we have to
          // move the cursor, or unfocus and refocus the editor to get the blink
          // rate to update - so here we do that (unfocus and refocus)
          cm.getInputField().blur();
          cm.focus();
        }
      }
    }

    completions(editor: Object, callback: Function): void {
      const { completion, channels } = this.props;
      if (completion) {
        codeComplete(channels, editor).subscribe(callback);
      }
    }

    tips(editor: Object): void {
      const { tip, channels } = this.props;
      const currentTip = document.getElementById('cl');
      const body = document.body;
      if (currentTip && body != null) {
        body
        .removeChild(currentTip);
        editor.setSize('auto', 'auto');
        return;
      }
      if (tip) {
        tool(channels, editor).subscribe(resp => {
          const bundle = ImmutableMap(resp.dict);
          const mimetype = "text/plain";
          // $FlowFixMe: until transforms refactored for new export interface GH #1488
          const Transform = transforms.get(mimetype);
          const node = document.createElement("div");
          node.className = "CodeMirror-hint tip";
          node.id = "cl";
          ReactDOM.render(<Transform data={bundle.get(mimetype)} />, node);
          const node2 = document.createElement("button");
          node2.className = "bt";
          node2.id = "btnid";
          node2.textContent = "\u2715";
          node2.style.fontSize = "11.5px";
          node.appendChild(node2);
          node2.onclick = function removeButton() {
            this.parentNode.parentNode.removeChild(this.parentNode);
            return false;
          };
            editor.addWidget({ line: editor.getCursor().line, ch: 0 }, node, true);
            const x = document.getElementById('cl');
            if (x != null && body != null) {
              const pos = x.getBoundingClientRect();
              body.appendChild(x);
              x.style.top = pos.top + 'px';
            }
          });
      }
    }

    getCodeMirrorOptions({ cursorBlinkRate, language }: WrapperProps): Object {
      return {
        autoCloseBrackets: true,
        mode: language || "python",
        lineNumbers: false,
        lineWrapping: true,
        matchBrackets: true,
        theme: "composition",
        autofocus: false,
        hintOptions: {
          hint: this.hint,
          completeSingle: false, // In automatic autocomplete mode we don't want override
          extraKeys: {
            Right: pick
          }
        },
        extraKeys: {
          "Ctrl-Space": "autocomplete",
          Tab: this.executeTab,
          "Shift-Tab": editor => editor.execCommand("indentLess"),
          Up: this.goLineUpOrEmit,
          Down: this.goLineDownOrEmit,
          'Cmd-/': 'toggleComment',
          'Ctrl-/': 'toggleComment',
          'Cmd-.': this.tips
        },
        indentUnit: 4,
        cursorBlinkRate,
        ...customOptions
      };
    }

    goLineDownOrEmit(editor: Object): void {
      const cursor = editor.getCursor();
      const lastLineNumber = editor.lastLine();
      const lastLine = editor.getLine(lastLineNumber);
      if (
        cursor.line === lastLineNumber &&
        cursor.ch === lastLine.length &&
        !editor.somethingSelected()
      ) {
        CM.signal(editor, "bottomBoundary");
      } else {
        editor.execCommand("goLineDown");
      }
    }

    goLineUpOrEmit(editor: Object): void {
      const cursor = editor.getCursor();
      if (cursor.line === 0 && cursor.ch === 0 && !editor.somethingSelected()) {
        CM.signal(editor, "topBoundary");
      } else {
        editor.execCommand("goLineUp");
      }
    }

    executeTab(editor: Object): void {
      editor.somethingSelected()
        ? editor.execCommand("indentMore")
        : editor.execCommand("insertSoftTab");
    }

    render(): React.Element<*> {
      const { input, onChange, onFocusChange } = this.props;
      const options = this.getCodeMirrorOptions(this.props);

      return (
        <EditorView {...this.props}>
          <CodeMirror
            value={input}
            ref={el => {
              this.codemirror = el;
            }}
            className="cell_cm"
            options={options}
            onChange={onChange}
            onClick={() => this.codemirror.focus()}
            onFocusChange={onFocusChange}
          />
        </EditorView>
      );
    }
  };

export default CodeMirrorWrapper;
