'use strict';
const electron = require('electron');
const {download} = require('electron-dl');
const isDev = require('electron-is-dev');

function create(win, opts) {
	(win.webContents || win.getWebContents()).on('context-menu', (e, props) => {
		const editFlags = props.editFlags;
		const hasText = props.selectionText.trim().length > 0;
		const can = type => editFlags[`can${type}`] && hasText;

		let menuTpl = [{
			type: 'separator'
		}, {
			label: 'Cut',
			// needed because of macOS limitation:
			// https://github.com/electron/electron/issues/5860
			role: can('Cut') ? 'cut' : '',
			enabled: can('Cut'),
			visible: props.isEditable
		}, {
			label: 'Copy',
			role: can('Copy') ? 'copy' : '',
			enabled: can('Copy'),
			visible: props.isEditable || hasText
		}, {
			label: 'Paste',
			role: editFlags.canPaste ? 'paste' : '',
			enabled: editFlags.canPaste,
			visible: props.isEditable
		}, {
			type: 'separator'
		}];

		if (props.mediaType === 'image') {
			menuTpl = [{
				type: 'separator'
			}, {
				label: 'Save Image',
				click(item, win) {
					download(win, props.srcURL);
				}
			}, {
				type: 'separator'
			}];
		}

		if (props.linkURL && props.mediaType === 'none') {
			menuTpl = [{
				type: 'separator'
			}, {
				label: 'Copy Link',
				click() {
					if (process.platform === 'linux') {
						electron.clipboard.writeText(props.linkURL);
					} else {
						electron.clipboard.writeBookmark(props.linkText, props.linkURL);
					}
				}
			}, {
				type: 'separator'
			}];
		}

		if (opts.prepend) {
			menuTpl.unshift(...opts.prepend(props));
		}

		if (opts.append) {
			menuTpl.push(...opts.append(props));
		}

		if (opts.showInspectElement || (opts.showInspectElement !== false && isDev)) {
			menuTpl.push({
				type: 'separator'
			}, {
				label: 'Inspect Element',
				click(item, win) {
					win.webContents.inspectElement(props.x, props.y);

					if (win.webContents.isDevToolsOpened()) {
						win.webContents.devToolsWebContents.focus();
					}
				}
			}, {
				type: 'separator'
			});
		}

		// filter out leading/trailing separators
		// TODO: https://github.com/electron/electron/issues/5869
		menuTpl = menuTpl.filter((el, i, arr) => !(el.type === 'separator' && (i === 0 || i === arr.length - 1 || arr[i + 1].type === 'separator')));

		const menu = (electron.Menu || electron.remote.Menu).buildFromTemplate(menuTpl);

		/*
		 * When electron.remote is not available this runs in the browser process.
		 * We can safely use win in this case as it refers to the window the
		 * context-menu should open in.
		 * When this is being called from a webView, we can't use win as this
		 * would refere to the webView which is not allowed to render a popup menu.
		 */
		menu.popup(electron.remote ? electron.remote.getCurrentWindow() : win);
	});
}

module.exports = (opts = {}) => {
	if (opts.window) {
		const win = opts.window;
		const webContents = win.webContents || win.getWebContents();

		// When window is a webview that has not yet finished loading webContents is not available
		if (webContents === undefined) {
			win.addEventListener('dom-ready', () => {
				create(win, opts);
			}, {once: true});
			return;
		}

		return create(win, opts);
	}

	(electron.BrowserWindow || electron.remote.BrowserWindow).getAllWindows().forEach(win => {
		create(win, opts);
	});

	(electron.app || electron.remote.app).on('browser-window-created', (e, win) => {
		create(win, opts);
	});
};
