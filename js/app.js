window.jsApp = {

    InvokeMermaid: function (name) {        
        // Ensure the library is initialized before running
        setupMermaid();
        // Manually run the mermaid renderer on all matching elements
        mermaid.run();
        console.log("run initiated. " + name);       
    }

};
