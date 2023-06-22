import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import actions from '@cocreate/actions';
import render from '@cocreate/render';
import '@cocreate/element-prototype';

let inputs = new Map();

function init(elements) {
    // Returns an array of elements.
    if (!elements)
        elements = document.querySelectorAll('[type="file"]')

    // If elements is an not array of elements returns an array of elements.
    else if (!Array.isArray(elements))
        elements = [elements]
    for (let i = 0; i < elements.length; i++) {
        if (elements[i].tagName !== 'INPUT') {
            // TODO: create input and append to div if input dos not exist
            // check if input exist
            let input = document.createElement("input");
            input.type = "file";
            input.setAttribute('hidden', '')
            elements[i].appendChild(input);
        }

        elements[i].getValue = async () => await getFiles([elements[i]])
        elements[i].getFiles = async () => await getFiles([elements[i]])

        // elements[i].setValue = (value) => pickr.setColor(value);

        if (elements[i].hasAttribute('directory')) {
            if (window.showDirectoryPicker)
                elements[i].addEventListener("click", fileEvent);
            else if ('webkitdirectory' in elements[i]) {
                elements[i].webkitdirectory = true
                elements[i].addEventListener("change", fileEvent)
            } else
                console.error("Directory selection not supported in this browser.");
        } else if (window.showOpenFilePicker)
            elements[i].addEventListener("click", fileEvent);
        else
            elements[i].addEventListener("change", fileEvent);
    }
}

async function fileEvent(event) {
    try {
        const input = event.target;
        let selected = inputs.get(input) || new Map()

        let files = input.files;
        if (!files.length) {
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

            files[i].directory = handle.directory || '/'
            files[i].parentDirectory = handle.parentDirectory || ''
            files[i].path = handle.path || '/' + handle.name
            files[i]['content-type'] = files[i].type
            files[i].input = input
            files[i].id = await getFileId(files[i])
            if (selected.has(files[i].id)) {
                console.log('Duplicate file has been selected. This could be in error as the browser does not provide a clear way of checking duplictaes')
            }

            selected.set(files[i].id, files[i])
        }

        if (selected.size) {
            inputs.set(input, selected);
            console.log("Files selected:", selected);
            renderFiles(input)
            const isImport = input.getAttribute('import')
            if (isImport || isImport == "") {
                // Import(input)
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
        entry.directory = '/' + name
        entry.parentDirectory = name.split("/").pop();
        entry.path = '/' + name + '/' + entry.name
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

async function getFileId(file, selected) {

    if (file.id = file.path || file.webkitRelativePath) {
        return file.id;
    } else {
        const { name, size, type, lastModified } = file;
        const key = `${name}${size}${type}${lastModified}`;

        file.id = key
        return key;
    }
}

async function getFiles(fileInputs, isGetData) {
    const files = [];

    if (!Array.isArray(fileInputs))
        fileInputs = [fileInputs]

    for (let input of fileInputs) {
        const selected = inputs.get(input)
        if (selected)
            for (let file of selected.values()) {
                if (!file.src)
                    file = await readFile(file)
                if (isGetData !== false)
                    file = getData({ ...file })
                files.push(file)
            }
    }

    return files
}

function getData(file) {
    let form = document.querySelector(`[file_id="${file.id}"]`);
    if (form) {
        let elements = form.querySelectorAll('[file]');
        for (let i = 0; i < elements.length; i++) {
            let name = elements[i].getAttribute('file')
            if (name) {
                file[name] = elements[i].getValue()
            }
        }
    }
    return file;
}


// This function reads the file and returns its src
function readFile(file) {
    // Return a new promise that resolves the file object
    return new Promise((resolve) => {
        // Split the file type into an array
        const fileType = file.type.split('/');
        let readAs;

        // Check if the file type is a directory
        if (fileType[1] === 'directory') {
            return resolve(file)
        }
        // Check if the file type is a image
        else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileType[1])
            || fileType[0] === 'image') {
            readAs = 'readAsDataURL';
        }
        // Check if the file type is a video
        else if (['mp4', 'avi', 'mov', 'mpeg', 'flv'].includes(fileType[1])
            || fileType[0] === 'video') {
            readAs = 'readAsDataURL';
        }
        // Check if the file type is an audio
        else if (['mp3', 'wav', 'wma', 'aac', 'ogg'].includes(fileType[1])
            || fileType[0] === 'audio') { // updated condition
            readAs = 'readAsDataURL';
        }
        // Check if the file type is a pdf
        else if (fileType[1] === 'pdf') {
            readAs = 'readAsDataURL';
        }
        // Check if the file type is a document
        else if (['doc', 'msword', 'docx', 'xlsx', 'pptx'].includes(fileType[1])) {
            readAs = 'readAsBinaryString';
        }
        // Otherwise, assume the file type is text
        else {
            readAs = 'readAsText';
        }

        // Create a FileReader instance to read the file
        const reader = new FileReader();
        // Read the file based on the file type
        reader[readAs](file);
        // When the file is loaded, resolve the file object
        reader.onload = () => {
            file.src = reader.result;
            // If the file type is a document, convert it to base64 encoding
            if (['doc', 'msword', 'docx', 'xlsx', 'pptx'].includes(fileType)) {
                file.src = btoa(file.src);
            }

            // Resolve the file object
            resolve(file);
        };
    });
}

async function renderFiles(input) {
    let template_id = input.getAttribute('template_id')
    if (template_id) {
        let template = document.querySelector(`[template="${template_id}"]`)
        template.setAttribute('file_id', '{{id}}')
        const data = await getFiles(input, false)
        if (!data.length) return
        render.data({
            selector: `[template='${template_id}']`,
            data
        });
    }
}

async function fileFormAction(data) {
    const action = data.name
    const form = data.element.closest('form')
    let inputs = form.querySelectorAll('input[type="file"]')
    // if (action === 'export') {
    //     Export(inputs)
    // } else if (action === 'download') {
    //     save(inputs[i])
    // }
    for (let i = 0; i < inputs.length; i++) {
        if (action === 'upload')
            upload(inputs[i])
        else if (action === 'saveLocally' || action === 'saveAs') {
            save(inputs[i])
        }
        else if (action === 'export') {
            Export(inputs[i])
        }
        else if (action === 'import') {
            Import(inputs[i])
        } else {
        }
    }

    document.dispatchEvent(new CustomEvent(action, {
        detail: {}
    }));

}

async function fileRenderAction(data) {
    const action = data.name
    const element = data.element
    let file_id = element.getAttribute('file_id');
    if (!file_id) {
        const closestElement = element.closest('[file_id]');
        if (closestElement) {
            file_id = closestElement.getAttribute('file_id');
        }
    }
    if (!file_id) return

    let templateid = element.closest('[templateid]')
    if (templateid)
        templateid = templateid.getAttribute('templateid')

    const input = document.querySelector(`[type="file"][template_id="${templateid}"]`)
    if (!input) return

    let file = inputs.get(input).get(file_id)
    if (!file) return

    if (action === 'createFile') {
        let name = element.getAttribute('value')
        create(file, 'file', name)
    }
    else if (action === 'deleteFile')
        Delete(file)
    else if (action === 'createDirectory') {
        let name = element.getAttribute('value')
        create(file, 'directory', name)
    }
    else if (action === 'deleteDirectory')
        Delete(file)

    document.dispatchEvent(new CustomEvent(action, {
        detail: {}
    }));

}

async function save(input, action) {
    try {
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
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error selecting files:", error);
        }
    }
}

async function upload(input) {
    let collection = input.getAttribute('collection')
    let document_id = input.getAttribute('document_id')
    let files = await getFiles(input)

    let document
    if (input.name) {
        document = { _id: document_id, [input.name]: files }
    } else {
        document = files
    }

    let response = await crud.updateDocument({
        collection,
        document,
        upsert: true
    });

    if (response && (!document_id || document_id !== response.document_id)) {
        crud.setDocumentId(element, collection, response.document_id);
    }

    return response
}

async function Import(input) {
    let files = await getFiles(input)
    const data = files.reduce((result, { src }) => {
        try {
            const parsedSrc = JSON.parse(src);
            if (Array.isArray(parsedSrc))
                result.push(...parsedSrc);
            else
                result.push(parsedSrc);
        } catch (error) {
            console.error(`Error parsing JSON: ${error}`);
        }
        return result;
    }, []);

    let response = await crud.createDocument(data);

    return response
}

async function Export(btn, inputs) {
    let data = crud.getAttributes(btn);
    const template_id = btn.getAttribute('template_id');

    if (data.storage || data.database || data.collection) {
        let name = data.name
        if (data.document_id) {
            data.document = { _id: data.document_id }
            delete data.document_id
            delete data.name
        }
        data = await crud.readDocument(data);

        if (name) {
            data = data.document[0][name]
        }

    } else if (template_id) {
        console.log('export json data used to render templates')
    } else {
        data = getFiles(inputs)
    }
    // let item = this.items.get(item_id)
    // if (!item) return;


    // let Item = new Object(item)
    // Item.filter.startIndex = 0;
    // delete Item.el
    // delete Item.count

    // let data;
    // if (crud) {
    //     data = await crud.readDocument(Item);
    // }
    // TODO: get from local data source
    exportFile(data);
}

async function exportFile(data) {
    let file_name = data.type || 'download';
    let exportData = JSON.stringify(data.document, null, 4);
    let blob = new Blob([exportData], { type: "application/json" });
    let url = URL.createObjectURL(blob);

    let link = document.createElement("a");

    link.href = url;
    link.download = file_name;

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

    document.dispatchEvent(new CustomEvent('exported', {
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
                file.directory = directory.path
                file.parentDirectory = directory.name
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

observer.init({
    name: 'CoCreateFileAddedNodes',
    observe: ['addedNodes'],
    target: 'input[type="file"]',
    callback: mutation => init(mutation.target)

});

observer.init({
    name: 'CoCreateFileAttributes',
    observe: ['attributes'],
    attributeName: ['type'],
    target: 'input[type="file"]',
    callback: mutation => init(mutation.target)
});

observer.init({
    name: 'fileRender',
    observe: ['attributes'],
    attributeName: ['template_id'],
    target: 'input[type="file"]',
    callback: mutation => renderFiles(mutation.target)
});

actions.init(
    {
        name: ["upload", "download", "saveLocally", "import", "export"],
        callback: (action) => {
            fileFormAction(action)
        }
    },
    {
        name: ["createFile", "deleteFile", "createDirectory", "deleteDirectory"],
        callback: (action) => {
            fileRenderAction(action)
        }
    }
)

init()

export default { getFiles, create, Delete }