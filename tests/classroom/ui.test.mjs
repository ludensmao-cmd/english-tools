import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { ApiError } from '../../dist/lessons/classroom-api.mjs';

// Execute the actual UI functions against a small DOM adapter. Clearing a file
// input clears its FileList, as in the browser; draft Files must live elsewhere.
class Node {
  constructor(id = '') { this.id = id; this.disabled = false; this.hidden = false; this.files = []; this.children = []; this.listeners = new Map(); this.classList = { toggle() {} }; this.attributes = new Map(); this._value = ''; }
  get value() { return this._value; }
  set value(value) { this._value = value; if (this.id.includes('files') && value === '') this.files = []; }
  replaceChildren(...children) { this.children = children; if (this.id.includes('select') || ['lesson-student', 'task-lesson', 'complete-lesson'].includes(this.id)) this._value = children[0]?.value || ''; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  querySelector() { return null; }
  dispatch(type) { return this.listeners.get(type)?.({ currentTarget: this, target: this, preventDefault() {} }); }
}
async function ui() {
  const source = await readFile(new URL('../../dist/lessons/lessons.js', import.meta.url), 'utf8');
  const bootstrap = source.lastIndexOf('try {\n  const session = await api.session(); user = session.user;');
  assert.ok(bootstrap > 0, 'UI bootstrap boundary must be present');
  const nodes = new Map(); const node = id => { if (!nodes.has(id)) nodes.set(id, new Node(id)); return nodes.get(id); };
  const main = new Node('main'); main.inert = false;
  const uploads = [], mutations = [];
  const actor = { id: 'teacher-1', role: 'teacher', name: 'Преподаватель' };
  const client = { session: async () => ({ user: actor }), upload: async file => { uploads.push(file); return { id: 'uploaded-file-1' }; }, mutate: async (path, input) => { mutations.push({ path, input }); } };
  const context = vm.createContext({ createApiClient: () => client, ApiError, URL, document: { getElementById: node, createElement: () => new Node(), querySelector: () => main, querySelectorAll: () => [...nodes.values()] }, location: { origin: 'http://127.0.0.1:4174' }, actor });
  vm.runInContext(source.slice(0, bootstrap).replace(/^import[^\n]+\n/, ''), context);
  vm.runInContext('user = actor; refreshAfterSave = async () => {};', context);
  const execute = code => vm.runInContext(code, context);
  return { node, main, uploads, mutations, execute };
}
function lessonDraft(f, file) {
  f.execute("data = { lessons: [{ id: 'lesson-1', summary: '', vocabulary: [], materials: [] }] }; lastCompleteId = 'lesson-1';");
  f.node('complete-lesson').value = 'lesson-1';
  f.node('lesson-summary').value = 'Повторили знакомство';
  f.node('lesson-words').value = '';
  f.node('lesson-materials').value = '';
  f.node('lesson-material-files').files = [file];
  f.execute('saveCompleteDraft();');
}
test('selected_material_survives_repaint_and_edit_in_open_tab', async () => {
  const f = await ui(); const file = new File(['words'], 'словарь.pdf'); lessonDraft(f, file);
  f.execute('loadCompleteDraft();');
  assert.equal(f.node('lesson-material-files').files.length, 0, 'browser file input cannot be repopulated');
  f.node('lesson-summary').value = 'Добавили новую тему';
  f.execute('saveCompleteDraft(); loadCompleteDraft(); saveCompleteDraft();');
  assert.equal(f.execute("completeDrafts.get('lesson-1').files[0]"), file);
  assert.equal(f.execute("completeDrafts.get('lesson-1').summary"), 'Добавили новую тему');
  assert.equal(f.node('lesson-selected-files').children[0].textContent, file.name);
});
test('retained_material_is_uploaded_by_actual_submit_handler', async () => {
  const f = await ui(); const file = new File(['material'], 'повторение.txt'); lessonDraft(f, file);
  f.execute('wireTeacher(); loadCompleteDraft();');
  f.node('complete-form').dispatch('submit');
  for (let n = 0; n < 20 && !f.mutations.length; n++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.uploads[0], file, 'submit must send retained File, despite empty native input');
  assert.equal(f.mutations[0].input.materials[0].attachmentId, 'uploaded-file-1');
});
test('first_records_leave_select_enabled_after_operation', async () => {
  const f = await ui();
  for (const id of ['lesson-student', 'task-lesson', 'complete-lesson', 'assignment-select']) {
    f.node(id).disabled = true; f.execute(`globalThis.currentSelect = document.getElementById('${id}');`);
    await f.execute("run(null, async () => { options(currentSelect, [{ id: 'first-record' }], row => row.id); return 'Данные обновлены'; });");
    assert.equal(f.node(id).disabled, false, id + ' must follow newly rendered data');
    assert.equal(f.node(id).value, 'first-record');
    assert.equal(f.main.inert, false, 'temporary interaction block is released');
  }
});
test('explicit_file_change_and_clear_replace_retained_selection', async () => {
  const f = await ui(); const first = new File(['one'], 'первый.txt'); const second = new File(['two'], 'второй.txt'); lessonDraft(f, first);
  f.execute('wireTeacher(); loadCompleteDraft();');
  f.node('lesson-material-files').files = [second]; f.node('lesson-material-files').dispatch('change');
  assert.equal(f.execute("completeDrafts.get('lesson-1').files[0]"), second);
  f.execute('loadCompleteDraft();'); f.node('lesson-clear-files').dispatch('click'); f.execute('saveCompleteDraft();');
  assert.equal(f.execute("completeDrafts.get('lesson-1').files.length"), 0);
  assert.equal(f.node('lesson-selected-files').children.length, 0);
});
