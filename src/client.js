import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import action from '@cocreate/actions';
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
                elements[i].addEventListener("click", selectDirectory);
            else if ('webkitdirectory' in elements[i]) {
                elements[i].webkitdirectory = true
                elements[i].addEventListener("change", fileInputChange)
            } else
                console.error("Directory selection not supported in this browser.");
        } else if (window.showOpenFilePicker)
            elements[i].addEventListener("click", selectFile);
        else
            elements[i].addEventListener("change", fileInputChange);
    }
}

async function fileInputChange(event) {
    const input = event.target;
    const files = input.files;
    let selected = inputs.get(input) || new Map()
    for (let i = 0; i < files.length; i++) {
        let fileId = await getFileId(files[i], selected)
        selected.set(fileId, { handle, file: files[i] })
    }
    inputs.set(input, selected);
    console.log("FileList:", Array.from(selected.values()));
    renderFiles(input)
}

async function selectFile(event) {
    event.preventDefault()
    const input = event.target;
    let selected = inputs.get(input) || new Map()
    try {
        const multiple = input.multiple
        const selectedFiles = await window.showOpenFilePicker({ multiple });

        for (const handle of selectedFiles) {
            let file = handle.getFile()
            let fileId = await getFileId(file, selected)
            selected.set(fileId, { handle, file })
        }

        if (selected.size) {
            inputs.set(input, selected);
            console.log("Files selected:", selected);
            renderFiles(input)
        }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error selecting files:", error);
        }
    }
}

async function selectDirectory(event) {
    event.preventDefault()
    const input = event.target;
    let selected = inputs.get(input) || new Map()

    try {
        const handle = await window.showDirectoryPicker();
        let file = {
            name: handle.name,
            directory: '/',
            path: '/' + handle.name,
            type: 'text/directory',
            'content-type': 'text/directory'
        }

        file.id = await getFileId(file, selected)
        selected.set(file.id, { handle, file })

        const handles = await getSelectedDirectoryHandles(handle, handle.name)
        for (let i = 0; i < handles.length; i++) {
            let file = handles[i]
            if (handles[i].kind === 'file') {
                file = await handles[i].getFile();
                file = { ...file, ...handles[i] }
            }

            file['content-type'] = file.type
            file.id = await getFileId(file, selected)
            selected.set(file.id, { handle: handles[i], file })
        }

        if (selected.size) {
            inputs.set(input, selected);
            console.log("Directory selected:", selected);
            renderFiles(input)
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error selecting directory:", error);
        }
    }
}

async function getSelectedDirectoryHandles(handle, name) {
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
            const entries = await getSelectedDirectoryHandles(entry, name + '/' + entry.name);
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

        if (selected.has(key)) {
            console.log('Duplicate file has been selected. This could be in error as the browser does not provide a clear way of checking duplictaes')
        }

        file.id = key
        return key;
    }
}

async function getFiles(fileInputs) {
    const files = [];

    if (!Array.isArray(fileInputs))
        fileInputs = [fileInputs]

    for (let input of fileInputs) {
        const selected = inputs.get(input)
        for (const value of selected.values()) {
            let file = await readFile(value.file)
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

async function getNewFileHandle() {
    // const options = {
    //     types: [
    //         {
    //             description: 'Text Files',
    //             accept: {
    //                 'text/plain': ['.txt'],
    //             },
    //         },
    //     ],
    // };
    const handle = await window.showSaveFilePicker(options);
    return handle;
}

async function fileAction(btn, params, action) {
    const form = btn.closest('form')
    let inputs = form.querySelectorAll('input[type="file"]')
    for (let i = 0; i < inputs.length; i++) {
        await save(inputs[i])
    }

    document.dispatchEvent(new CustomEvent(action, {
        detail: {}
    }));

}

async function save(input) {
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

async function renderFiles(input) {
    let template_id = input.getAttribute('template_id')
    if (template_id) {
        let template = document.querySelector(`[template="${template_id}"]`)
        template.setAttribute('file_id', '{{id}}')
        const data = await getFiles(input)
        if (!data.length) return
        render.data({
            selector: `[template='${template_id}']`,
            data
        });
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

action.init({
    name: "upload",
    callback: (btn, params) => {
        fileAction(btn, params, "upload")
    }
})

init()

export default { getFiles }