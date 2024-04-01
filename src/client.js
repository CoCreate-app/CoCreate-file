/********************************************************************************
 * Copyright (C) 2023 CoCreate and Contributors.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 ********************************************************************************/

/**
 * Commercial Licensing Information:
 * For commercial use of this software without the copyleft provisions of the AGPLv3,
 * you must obtain a commercial license from CoCreate LLC.
 * For details, visit <https://cocreate.app/licenses/> or contact us at sales@cocreate.app.
 */

import Observer from '@cocreate/observer';
import Crud from '@cocreate/crud-client';
import Elements from '@cocreate/elements';
import Actions from '@cocreate/actions';
import { render } from '@cocreate/render';
import { queryElements } from '@cocreate/utils';
import '@cocreate/element-prototype';

const inputs = new Map();
const Files = new Map();

/**
 * Initializes file elements. If no parameter is provided, it queries and initializes all elements with type="file".
 * It can also initialize a single element or an array of elements. Specifically focuses on elements of type 'file'.
 * 
 * @param {(Element|Element[]|null)} [elements] - Optional. An element, an array of elements, or null. 
 *      - If null or omitted, the function queries and initializes all elements in the document with type="file".
 *      - If a single element is provided, it initializes that element (assuming it is of type "file").
 *      - If an array of elements is provided, each element in the array is initialized.
 */
async function init(elements) {
    if (!elements)
        elements = document.querySelectorAll('[type="file"]')
    else if (!Array.isArray(elements))
        elements = [elements]
    for (let i = 0; i < elements.length; i++) {
        let nestedInput, isInput = elements[i].tagName === 'INPUT'
        if (!isInput) {
            nestedInput = elements[i].querySelector('input[type="file"]')
        }

        elements[i].getValue = async () => await getFiles([elements[i]])
        elements[i].getFiles = async () => await getFiles([elements[i]])
        elements[i].setValue = (files) => setFiles(elements[i], files);
        elements[i].renderValue = (files) => setFiles(elements[i], files);

        // if (elements[i].renderValue) {
        //     let data = await elements[i].getValue()
        //     if (data)
        //         elements[i].setValue(data)
        // }

        if (elements[i].hasAttribute('directory')) {
            if (!isInput && window.showDirectoryPicker)
                elements[i].addEventListener("click", fileEvent);
            else if ('webkitdirectory' in elements[i]) {
                elements[i].webkitdirectory = true
                if (!isInput && !nestedInput) {
                    nestedInput = document.createElement("input");
                    nestedInput.type = "file";
                    nestedInput.setAttribute('hidden', '')
                    elements[i].appendChild(nestedInput);
                }

                if (nestedInput) {
                    elements[i].addEventListener("click", function () {
                        nestedInput.click()
                    });
                    nestedInput.addEventListener("change", fileEvent);
                } else
                    elements[i].addEventListener("change", fileEvent);
            } else
                console.error("Directory selection not supported in this browser.");
        } else if (!isInput && window.showOpenFilePicker)
            elements[i].addEventListener("click", fileEvent);
        else {
            if (!isInput && !nestedInput) {
                nestedInput = document.createElement("input");
                nestedInput.type = "file";
                nestedInput.setAttribute('hidden', '')
                elements[i].appendChild(nestedInput);
            }

            if (nestedInput) {
                elements[i].addEventListener("click", function () {
                    nestedInput.click()
                });
                nestedInput.addEventListener("change", fileEvent);
            } else
                elements[i].addEventListener("change", fileEvent);
        }
    }
}

async function fileEvent(event) {
    try {
        const input = event.target;
        let selected = inputs.get(input) || new Map()
        let files = input.files;
        if (!files || !files.length) {
            event.preventDefault()
            const multiple = input.multiple
            if (input.hasAttribute('directory')) {
                let handle = await window.showDirectoryPicker();
                let file = {
                    name: handle.name,
                    directory: '/',
                    path: '/' + handle.name,
                    type: 'text/directory',
                    'content-type': 'text/directory'
                }
                file.input = input
                file.id = await getFileId(file)
                if (selected.has(file.id)) {
                    console.log('Duplicate file has been selected. This could be in error as the browser does not provide a clear way of checking duplictaes')
                }

                file.handle = handle
                selected.set(file.id, file)
                Files.set(file.id, file)

                files = await getDirectoryHandles(handle, handle.name)
            } else {
                files = await window.showOpenFilePicker({ multiple });
            }
        }

        for (let i = 0; i < files.length; i++) {
            const handle = files[i]
            if (files[i].kind === 'file') {
                files[i] = await files[i].getFile();
                files[i].handle = handle
            } else if (files[i].kind === 'directory') {
                files[i].handle = handle
            }

            if (!files[i].src)
                await readFile(files[i])
            // if (!files[i].src)
            //     files[i].src = files[i]

            // if (!files[i].src.name)
            //     files[i].src = files[i]

            if (!files[i].size)
                files[i].size = handle.size

            files[i].directory = handle.directory || '/'
            files[i].path = handle.path || '/'
            files[i].pathname = handle.pathname || '/' + handle.name
            files[i]['content-type'] = files[i].type
            files[i].input = input
            files[i].id = await getFileId(files[i])
            if (selected.has(files[i].id)) {
                console.log('Duplicate file has been selected. This could be in error as the browser does not provide a clear way of checking duplictaes')
            }

            selected.set(files[i].id, files[i])
            Files.set(files[i].id, files[i])
        }

        if (selected.size) {
            inputs.set(input, selected);
            console.log("Files selected:", selected);

            if (input.renderValue)
                input.renderValue(Array.from(selected.values()));

            const isImport = input.getAttribute('import')
            const isRealtime = input.getAttribute('realtime')
            if (isRealtime && isRealtime !== 'false') {
                if (isImport || isImport == "") {
                    Import(input)
                } else if (input.save)
                    input.save()
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error selecting directory:", error);
        }
    }

}

async function getDirectoryHandles(handle, name) {
    let handles = [];
    for await (const entry of handle.values()) {
        entry.directory = name
        entry.path = '/' + name + '/'
        entry.pathname = '/' + name + '/' + entry.name
        if (!entry.webkitRelativePath)
            entry.webkitRelativePath = name

        if (entry.kind === 'file') {
            handles.push(entry);
        } else if (entry.kind === 'directory') {
            entry.type = 'text/directory'
            handles.push(entry);
            const entries = await getDirectoryHandles(entry, name + '/' + entry.name);
            handles = handles.concat(entries);
        }
    }
    return handles;
}

async function getFileId(file) {

    if (file.id = file.path || file.webkitRelativePath) {
        return file.id;
    } else {
        const { name, size, type, lastModified } = file;
        const key = `${name}${size}${type}${lastModified}`;

        file.id = key
        return key;
    }
}

async function getFiles(fileInputs, readAs) {
    const files = [];

    if (!Array.isArray(fileInputs))
        fileInputs = [fileInputs]

    for (let input of fileInputs) {
        const selected = inputs.get(input)
        if (selected) {
            for (let file of Array.from(selected.values())) {
                if (!file.src) {
                    // if (readAs === 'blob')
                    file.src = file
                    // else
                    //     await readFile(file, readAs)
                }

                let fileObject = { ...file }
                fileObject.size = file.size
                await getCustomData(fileObject)

                files.push(fileObject)
            }
        }
    }

    return files
}

async function getCustomData(file) {
    // TODO: Consider potential replacment of file_id, perhaps supporting selector  
    let form = document.querySelector(`[file_id="${file.id}"]`);
    if (form) {
        let elements = form.querySelectorAll('[file]');
        for (let i = 0; i < elements.length; i++) {
            let name = elements[i].getAttribute('file')
            if (name) {
                file[name] = await elements[i].getValue()
            }
        }
    }

    delete file.input;

    return file;
}

// This function reads the file and returns its src
function readFile(file, readAs) {
    return new Promise((resolve) => {
        const fileType = file.type.split('/');

        if (fileType[1] === 'directory') {
            return resolve(file)
        } else if (readAs) {
            if (readAs === 'blob')
                return resolve(file)
        } else if (fileType[0] === 'image') {
            readAs = 'readAsDataURL';
        } else if (fileType[0] === 'video') {
            readAs = 'readAsDataURL';
        } else if (fileType[0] === 'audio') {
            readAs = 'readAsDataURL';
        } else if (fileType[1] === 'pdf') {
            readAs = 'readAsDataURL';
        } else if (['doc', 'msword', 'docx', 'xlsx', 'pptx'].includes(fileType[1])) {
            readAs = 'readAsBinaryString';
        } else {
            readAs = 'readAsText';
        }

        const reader = new FileReader();
        reader[readAs](file);

        reader.onload = () => {
            file.src = reader.result;
            if (['doc', 'msword', 'docx', 'xlsx', 'pptx'].includes(fileType)) {
                file.src = btoa(file.src);
            }

            resolve(file);
        };
    });
}

function setFiles(element, files) {
    if (!files) return
    if (!Array.isArray(files))
        files = [files]
    else if (!files.length)
        return

    let selected = inputs.get(element) || new Map()
    for (let i = 0; i < files.length; i++) {
        files[i].input = element
        selected.set(files[i].id, files[i])
        Files.set(files[i].id, files[i])
    }
    inputs.set(element, selected);
    if (element.renderValue)
        render({ source: element, data: Array.from(selected.values()) })
}

// TODO: Could this benifit from media processing to save results locally
async function save(element, action, data) {
    try {
        if (!data)
            data = []

        if (!Array.isArray(element))
            element = [element]

        for (let i = 0; i < element.length; i++) {
            const inputs = []
            if (element[i].type === 'file')
                inputs.push(element[i])
            else if (element[i].tagName === 'form') {
                let fileInputs = element[i].querySelectorAll('input[type="file"]')
                inputs.push(...fileInputs)
            } else {
                const form = element[i].closest('form')
                if (form)
                    inputs.push(...form.querySelectorAll('input[type="file"]'))
            }

            for (let input of inputs) {
                let files = await getFiles(input)

                for (let i = 0; i < files.length; i++) {
                    if (!files[i].src) continue

                    if (files[i].handle && action !== 'download') {
                        if (action === 'saveAs') {
                            if (files[i].kind === 'file') {
                                const options = {
                                    suggestedName: files[i].name,
                                    types: [
                                        {
                                            description: 'Text Files',
                                        }
                                    ],
                                };
                                files[i].handle = await window.showSaveFilePicker(options);
                            } else if (files[i].kind === 'directory') {
                                // Create a new subdirectory
                                files[i].handle = await files[i].handle.getDirectoryHandle('new_directory', { create: true });
                                return
                            }
                        }

                        if (files[i].handle.kind === 'directory') continue

                        const writable = await files[i].handle.createWritable();
                        await writable.write(files[i].src);
                        await writable.close();

                    } else {
                        const blob = new Blob([files[i].src], { type: files[i].type });

                        // Create a temporary <a> element to trigger the file download
                        const downloadLink = document.createElement('a');
                        downloadLink.href = URL.createObjectURL(blob);
                        downloadLink.download = files[i].name;

                        // Trigger the download
                        downloadLink.click();
                    }

                }
            }

            let queryElements = queryElements({ element: element[i], prefix: action })
            if (queryElements) {
                save(queryElements, action, data)
            }
        }
        return data

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error selecting files:", error);
        }
    }
}

async function upload(element, data) {
    if (!data)
        data = []

    if (!Array.isArray(element))
        element = [element]

    for (let i = 0; i < element.length; i++) {
        const fileInputs = []
        if (element[i].type === 'file')
            fileInputs.push(element[i])
        else if (element[i].tagName === 'form') {
            fileInputs.push(...element[i].querySelectorAll('input[type="file"]'))
        } else {
            const form = element[i].closest('form')
            if (form)
                fileInputs.push(...form.querySelectorAll('input[type="file"]'))
        }

        for (let input of fileInputs) {
            let Data = Elements.getObject(input);
            let object = input.getAttribute('object') || ''
            let key = input.getAttribute('key')

            Data.broadcastBrowser = false
            if (!Data.type || Data.type === 'key')
                Data.type = 'object'

            Data.method = Data.type + '.update'
            if (!Data.array)
                Data.array = 'files'

            let path = input.getAttribute('path')
            let directory = '/'

            if (path) {
                directory = path.split('/');
                directory = directory[directory.length - 1];
                if (!path.endsWith('/'))
                    path += '/'
            } else
                path = directory = '/'

            if (!Data.host)
                Data.host = ['*']

            if (!Data.public)
                Data.public = true

            if (input.getFilter) {
                Data.$filter = await input.getFilter()
                if (!Data.$filter.query)
                    Data.$filter.query = {}
            } else
                Data.$filter = {
                    query: {}
                }


            // let files = await getFiles(input, 'blob')
            let files
            const selected = inputs.get(input)
            if (selected) {
                files = Array.from(selected.values())
            }

            let segmentSize = 10 * 1024 * 1024
            for (let i = 0; i < files.length; i++) {
                files[i].path = path
                files[i].pathname = path + files[i].name
                files[i].directory = directory

                // let fileObject = { ...file }
                // fileObject.size = file.size
                // await getCustomData(fileObject)


                if (input.processFile && files[i].size > segmentSize) {
                    // let test = await input.processFile(files[i], null, segmentSize, null, null, null, input);
                    // console.log('test')
                    let { playlist, segments } = await input.processFile(files[i], null, segmentSize);
                    files[i].src = playlist
                    for (let j = 0; j < segments.length; j++) {
                        segments[j].path = path
                        segments[j].pathname = path + segments[j].name
                        segments[j].directory = directory
                        segments[j] = { ...segments[j], ...await readFile(segments[j].src) }
                        segments[j].public = true
                        segments[j].host = ['*']

                        playlist.segments[j].src = segments[j].pathname
                        Data.$filter.query.pathname = segments[j].pathname
                        Crud.send({
                            ...Data,
                            object: segments[j],
                            upsert: true
                        });
                    }

                } else {
                    files[i] = { ...files[i], ...await readFile(files[i].src) }
                }

                if (!key) {
                    Data[Data.type] = { ...files[i] }
                } else {
                    Data[Data.type] = { [key]: { ...files[i] } }
                }

                if (object) {
                    Data[Data.type]._id = object // test
                }

                delete Data[Data.type].input
                Data.$filter.query.pathname = files[i].pathname
                let response = await Crud.send({
                    ...Data,
                    upsert: true
                });

                console.log(response, 'tes')
                // if (response && (!object || object !== response.object)) {
                //     Elements.setTypeValue(element, response);
                // }

            }
        }

        let queriedElements = queryElements({ element: element[i], prefix: 'upload' })
        if (queriedElements) {
            upload(queriedElements, data)
        }
    }
    return data
}

async function Import(element, data) {
    if (!data)
        data = []

    if (!Array.isArray(element))
        element = [element]

    for (let i = 0; i < element.length; i++) {
        const inputs = []
        if (element[i].type === 'file')
            inputs.push(element[i])
        else if (element[i].tagName === 'form') {
            let fileInputs = element[i].querySelectorAll('input[type="file"]')
            inputs.push(...fileInputs)
        } else {
            const form = element[i].closest('form')
            if (form)
                inputs.push(...form.querySelectorAll('input[type="file"]'))
        }

        if (inputs.length) {
            let Data = await getFiles(inputs)
            Data.reduce((result, { src }) => {
                try {
                    const parsedSrc = JSON.parse(src);
                    if (Array.isArray(parsedSrc))
                        data.push(...parsedSrc);
                    else
                        data.push(parsedSrc);
                } catch (error) {
                    console.error(`Error parsing JSON: ${error}`);
                }
                return result;
            }, []);

        }

        if (element[i].type !== 'file') {
            let Data = Elements.getObject(element[i]);
            if (Data.type) {
                if (element[i].getFilter)
                    Data.$filter = await element[i].getFilter()

                if (Data.type === 'key')
                    Data.type = 'object'

                data.push(Data)
            }
        }

        if (data.length) {
            for (let i = 0; i < data.length; i++) {
                // TODO: if _id exist use update method
                data[i].method = data[i].type + '.create'
                data[i] = await Crud.send(data[i])
            }
        }

        let queriedElements = queryElements({ element: element[i], prefix: 'import' })
        if (queriedElements) {
            Import(queriedElements, data)
        }
    }
    return data
}

async function Export(element, data) {
    if (!data)
        data = []

    if (!Array.isArray(element))
        element = [element]

    for (let i = 0; i < element.length; i++) {
        const inputs = []
        if (element[i].type === 'file')
            inputs.push(element[i])
        else if (element[i].tagName === 'form') {
            let fileInputs = element[i].querySelectorAll('input[type="file"]')
            inputs.push(...fileInputs)
        } else {
            const form = element[i].closest('form')
            if (form)
                inputs.push(...form.querySelectorAll('input[type="file"]'))
        }

        if (inputs.length)
            data.push(...getFiles(inputs))

        let Data = Elements.getObject(element[i]);
        if (Data.type) {
            if (element[i].getFilter)
                Data.$filter = await element[i].getFilter()

            if (Data.type === 'key')
                Data.type = 'object'
            Data.method = Data.type + '.read'
            Data = await Crud.send(Data)
            data.push(...Data[Data.type])

        }

        let queriedElements = queryElements({ element: element[i], prefix: 'export' })
        if (queriedElements) {
            Export(queriedElements, data)
        }

    }

    if (data.length)
        exportFile(data);

    return data
}

async function exportFile(data) {
    let name = data.type || 'download';
    let exportData = JSON.stringify(data, null, 2);
    let blob = new Blob([exportData], { type: "application/json" });
    let url = URL.createObjectURL(blob);

    let link = document.createElement("a");

    link.href = url;
    link.download = name;

    document.body.appendChild(link);

    link.dispatchEvent(
        new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        })
    );

    URL.revokeObjectURL(url);
    link.remove();
}

async function fileRenderAction(action) {
    const element = action.element

    let file_id = element.getAttribute('file_id');
    if (!file_id) {
        const closestElement = element.closest('[file_id]');
        if (closestElement)
            file_id = closestElement.getAttribute('file_id');
    }

    let input = Files.get(file_id).input

    if (!file_id || !input) return

    let file = inputs.get(input).get(file_id)
    if (!file) return

    if (action.name === 'createFile') {
        let name = element.getAttribute('value')
        create(file, 'file', name)
    } else if (action.name === 'deleteFile')
        Delete(file)
    else if (action.name === 'createDirectory') {
        let name = element.getAttribute('value')
        create(file, 'directory', name)
    } else if (action.name === 'deleteDirectory')
        Delete(file)

    document.dispatchEvent(new CustomEvent(action.name, {
        detail: {}
    }));

}

async function create(directory, type, name, src = "") {
    try {
        if (directory.handle && directory.input) {
            if (!name) {
                const name = prompt('Enter the file name:');
                if (!name) {
                    console.log('Invalid file name.');
                    return;
                }

            }

            let handle, file
            if (type === 'directory') {
                handle = await directory.handle.getDirectoryHandle(name, { create: true });
                file = { name: handle.name, type: 'text/directory' }
            } else if (type === 'file') {
                handle = await directory.handle.getFileHandle(name, { create: true });
                const writable = await handle.createWritable();

                // Write data to the new file...
                await writable.write(src);
                await writable.close();

                file = handle.getFile()
            }

            if (directory.input) {
                file.directory = directory.name
                file.pathname = directory.path + '/' + file.name
                file.path = directory.path + '/' + file.name
                file.input = directory.input
                file.handle = handle
                file['content-type'] = file.type

                file.id = await getFileId(file)
                if (inputs.get(directory.input).has(file.id)) {
                    console.log('Duplicate file has been selected. This could be in error as the browser does not provide a clear way of checking duplictaes')
                }

                inputs.get(directory.input).set(file.id, file)
            }
        }
    } catch (error) {
        console.log('Error adding file:', error);
    }
}

async function Delete(file) {
    try {
        if (file.handle) {
            await file.handle.remove();
            if (file.input && file.id)
                inputs.get(file.input).delete(file.id)
        }
    } catch (error) {
        console.log('Error deleting file:', error);
    }
}

Observer.init({
    name: 'CoCreateFileAddedNodes',
    observe: ['addedNodes'],
    target: 'input[type="file"]',
    callback: mutation => init(mutation.target)

});

Observer.init({
    name: 'CoCreateFileAttributes',
    observe: ['attributes'],
    attributeName: ['type'],
    target: 'input[type="file"]',
    callback: mutation => init(mutation.target)
});

Actions.init([
    {
        name: ["upload", "download", "saveLocally", "import", "export"],
        callback: (action) => {
            if (action.name === 'upload')
                upload(action.element)
            else if (action.name === 'saveLocally' || action.name === 'saveAs') {
                save(action.element)
            } else if (action.name === 'export') {
                Export(action.element)
            } else if (action.name === 'import') {
                Import(action.element)
            } else {
                // Something...
            }

            document.dispatchEvent(new CustomEvent(action.name, {
                detail: {}
            }));

        }
    },
    {
        name: ["createFile", "deleteFile", "createDirectory", "deleteDirectory"],
        callback: (action) => {
            fileRenderAction(action)
        }
    }
])

init()

export default { inputs, getFiles, create, Delete }