const crud = require('@cocreate/crud-client')
const Config = require('@cocreate/config')
const fs = require('fs');
const path = require('path');
const mimeTypes = {
    ".aac": "audio/aac",
    ".abw": "application/x-abiword",
    ".arc": "application/x-freearc",
    ".avi": "video/x-msvideo",
    ".azw": "application/vnd.amazon.ebook",
    ".bin": "application/octet-stream",
    ".bmp": "image/bmp",
    ".bz": "application/x-bzip",
    ".bz2": "application/x-bzip2",
    ".csh": "application/x-csh",
    ".css": "text/css",
    ".csv": "text/csv",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".eot": "application/vnd.ms-fontobject",
    ".epub": "application/epub+zip",
    ".gif": "image/gif",
    ".htm": "text/html",
    ".html": "text/html",
    ".ico": "image/vnd.microsoft.icon",
    ".ics": "text/calendar",
    ".jar": "application/java-archive",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jsonld": "application/ld+json",
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".mjs": "text/javascript",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".mpeg": "video/mpeg",
    ".mpkg": "application/vnd.apple.installer+xml",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".oga": "audio/ogg",
    ".ogv": "video/ogg",
    ".ogx": "application/ogg",
    ".otf": "font/otf",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".rar": "application/x-rar-compressed",
    ".rtf": "application/rtf",
    ".sh": "application/x-sh",
    ".svg": "image/svg+xml",
    ".swf": "application/x-shockwave-flash",
    ".tar": "application/x-tar",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".ts": "video/mp2t",
    ".ttf": "font/ttf",
    ".txt": "text/plain",
    ".vsd": "application/vnd.visio",
    ".wav": "audio/wav",
    ".weba": "audio/webm",
    ".webm": "video/webm",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".xhtml": "application/xhtml+xml",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xml": "application/xml",
    ".xul": "application/vnd.mozilla.xul+xml",
    ".zip": "application/zip",
    ".3gp": "video/3gpp",
    ".3g2": "video/3gpp2",
    ".7z": "application/x-7z-compressed"
}

module.exports = async function file(CoCreateConfig) {

    let configFile = path.resolve(process.cwd(), 'CoCreate.config.js');
    if (fs.existsSync(configFile)) {
        CoCreateConfig = require(configFile);
    } else {
        console.log('CoCreate.config.js could not be found.')
        process.exit()
    }

    let { directories, sources } = CoCreateConfig;
    let config = await Config({
        organization_id: {
            prompt: 'Enter your organization_id: '
        },
        host: {
            prompt: 'Enter the host: '
        },
        prompt: {
            prompt: 'Choose an authentication option: \n1.key\n2.Sign In\n',
            choices: {
                '1': {
                    key: {
                        prompt: 'Enter your key: '
                    }
                },
                '2': {
                    email: {
                        prompt: 'Enter your email: '
                    },
                    password: {
                        prompt: 'Enter your password: '
                    }
                }
            }
        }
    })

    if (!config.organization_id || !config.host || !config.key && (!config.password || config.email)) {
        console.log('One or more required config params could not be found')
        process.exit()
    }


    crud.socket.create(config)
    config.broadcast = false

    if (config.email && config.password) {
        let request = {
            method: 'signIn',
            array: 'users',
            filter: {
                query: [
                    { key: 'email', value: config.email, operator: '$eq' },
                    { key: 'password', value: config.password, operator: '$eq' }
                ]
            }
        }

        let response = await crud.socket.send(request)
        let { success, token } = response;

        if (success) {
            console.log('succesful sign in')
            // apply token to socket
        } else {
            console.log('The email or password you entered is incorrect')
            process.exit()

        }

    }

    console.log('Uploading files...')

    /**
     * Store files by config directories
     **/
    let errorLog = [];

    async function runDirectories() {
        for (const directory of directories) {
            const entry = directory.entry
            const exclude = directory.exclude
            await runFiles(directory, entry, exclude)
        }
        return
    }

    async function runFiles(directory, entry, exclude, parentDirectory = '') {
        let files = fs.readdirSync(entry);

        for (let file of files) {
            if (exclude && exclude.includes(file)) continue

            let isDirectory = fs.existsSync(`${entry}/${file}`) && fs.lstatSync(`${entry}/${file}`).isDirectory();
            let name = file
            let source = ''
            let directoryName = parentDirectory || '';
            let parentDirectoryOnly = parentDirectory || '';
            let index = parentDirectoryOnly.lastIndexOf('/') + 1
            if (parentDirectoryOnly && index) {
                parentDirectoryOnly = parentDirectoryOnly.substring(index)
            }
            const fileExtension = path.extname(file);
            let mimeType = mimeTypes[fileExtension]
            let pathName = '';

            if (!directoryName && directory.object && directory.object.directory)
                directoryName = directory.object.directory.replace('{{directory}}', '').trim()
            else if (!directoryName)
                directoryName = '/'

            if (exclude && exclude.includes(directoryName)) continue

            if (directoryName.endsWith("/"))
                pathName = directoryName + name
            else if (directoryName)
                pathName = directoryName + '/' + name
            else
                pathName = '/' + name

            if (exclude && exclude.includes(pathName)) continue

            if (isDirectory)
                mimeType = "text/directory"
            else
                source = getSource(`${entry}/${file}`, mimeType)

            let values = {
                '{{name}}': name,
                '{{source}}': source,
                '{{directory}}': directoryName,
                '{{parentDirectory}}': parentDirectoryOnly,
                '{{path}}': pathName,
                '{{content-type}}': mimeType
            }

            let object = { ...directory.object }
            if (!object.name)
                object.name = "{{name}}"
            if (!object.src)
                object.src = "{{source}}"
            if (!object.directory)
                object.directory = "/{{directory}}"
            if (!object.parentDirectory)
                object.parentDirectory = "{{parentDirectory}}"
            if (!object.path)
                object.path = "{{path}}"
            if (!object["content-type"])
                object["content-type"] = '{{content-type}}'
            if (!object.public && object.public != false && object.public != 'false')
                object.public = 'true'

            let newObject = {
                array: directory.array || 'files',
                object
            }
            for (const key of Object.keys(directory.object)) {
                if (typeof directory.object[key] == 'string') {

                    let variables = directory.object[key].match(/{{([A-Za-z0-9_.,\[\]\-\/ ]*)}}/g);
                    if (variables) {
                        for (let variable of variables) {
                            if (variable == '{{directory}}') {
                                if (parentDirectory)
                                    newObject.object[key] = values[variable]
                                else
                                    newObject.object[key] = newObject.object[key].replace(variable, '');
                            }
                            else if (isDirectory && variable == '{{source}}')
                                delete newObject.object[key]
                            else
                                newObject.object[key] = newObject.object[key].replace(variable, values[variable]);
                        }
                    }

                }
            }

            if (!newObject.object._id)
                newObject.filter = {
                    query: [{ key: 'path', value: pathName, operator: '$eq' }]
                }

            response = await runStore(newObject);
            if (response.error)
                errorLog.push(response.error)

            if (isDirectory && pathName) {
                let newEntry
                if (entry.endsWith("/"))
                    newEntry = entry + name
                else
                    newEntry = entry + '/' + name

                await runFiles(directory, newEntry, exclude, pathName)
            }
        }
        if (errorLog.length)
            console.log(...errorLog)

    }


    function getSource(path, mimeType) {
        let readType = 'utf8'
        if (/^(image|audio|video)\/[-+.\w]+/.test(mimeType))
            readType = 'base64'

        let binary = fs.readFileSync(path);
        let content = new Buffer.from(binary).toString(readType);

        return content
    }

    /**
     * Store files by config sources
     **/
    async function runSources() {
        let updatedSources = [];

        for (let i = 0; i < sources.length; i++) {
            const { array, object } = sources[i];

            let source = { ...sources[i] };
            let keys = new Map()
            let response = {};

            try {
                if (array) {
                    if (!object)
                        object = {};
                    else
                        for (const key of Object.keys(object)) {
                            if (typeof object[key] != 'string')
                                continue

                            let variables = object[key].match(/{{([A-Za-z0-9_.,\[\]\-\/ ]*)}}/g);
                            if (variables) {
                                keys.set(key, `${object[key]}`)
                                let value = ""
                                for (let variable of variables) {
                                    let entry = /{{\s*([\w\W]+)\s*}}/g.exec(variable);
                                    entry = entry[1].trim()
                                    if (entry) {
                                        if (!fs.existsSync(entry))
                                            continue

                                        let read_type = 'utf8'
                                        const fileExtension = path.extname(entry);
                                        let mime_type = mimeTypes[fileExtension] || 'text/html'

                                        if (/^(image|audio|video)\/[-+.\w]+/.test(mime_type)) {
                                            read_type = 'base64'
                                        }

                                        let binary = fs.readFileSync(entry);
                                        let content = new Buffer.from(binary).toString(read_type);
                                        if (content)
                                            value += content
                                        // object[key] = object[key].replace(variable, content);
                                    }
                                }
                                object[key] = value
                            }

                        }

                    let data = { array, object }
                    if (!object._id && object.path)
                        data.filter = {
                            query: [{ key: 'path', value: object.path, operator: '$eq' }]
                        }

                    response = await runStore(data);
                }
            } catch (err) {
                console.log(err)
                process.exit()
            }
            if (response.object && response.object[0] && response.object[0]._id) {
                for (const [key, value] of keys) {
                    source.object[key] = value
                }
                source.object._id = response.object[0]._id
            } else {
                console.log('_id could not be found')
                process.exit()
            }

            updatedSources.push(source)
        }

        return updatedSources
    }


    async function runStore(data) {
        try {
            let response;
            if (!data.object._id && !data.filter) {
                response = await crud.send({
                    method: 'create.object',
                    ...config,
                    ...data
                })
            } else {
                response = await crud.send({
                    method: 'update.object',
                    ...config,
                    ...data,
                    upsert: true
                })
            }
            if (response) {
                return response;
            }
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    async function run() {
        if (directories)
            await runDirectories()

        if (sources) {
            let sources = await runSources()
            let newConfig = { ...CoCreateConfig }
            if (directories)
                newConfig.directories = directories

            newConfig.sources = sources

            if (newConfig.repositories)
                newConfig.repositories.forEach(obj => {
                    for (const key in obj) {
                        if (!["path", "repo", "exclude"].includes(key)) {
                            delete obj[key];
                        }
                    }
                });

            delete newConfig.url
            delete newConfig.broadcast
            const write_str = `module.exports = ${JSON.stringify(newConfig, null, 4)};`;

            fs.writeFileSync(configFile, write_str);
        }

        console.log('upload complete!');

        setTimeout(function () {
            process.exit()
        }, 2000)
    }

    run()
}
