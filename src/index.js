(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(["./client"], function (CoCreateFile) {
            return factory(CoCreateFile)
        });
    } else if (typeof module === 'object' && module.exports) {
        const CoCreateFile = require("./server.js")
        module.exports = factory(CoCreateFile);
    } else {
        root.returnExports = factory(root["./client.js"]);
    }
}(typeof self !== 'undefined' ? self : this, function (CoCreateFile) {
    return CoCreateFile;
}));