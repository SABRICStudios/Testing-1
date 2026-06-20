// technicaldata.js - Upgraded to save raw binary to IndexedDB
const imageInput = document.getElementById('imageInput');

// Helper to open/initialize IndexedDB
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('VisualsDB', 1);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images');
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error); 
    });
}

imageInput.addEventListener('change', async function(event) {
    const file = event.target.files[0];

    if (file) {
        try {
            const db = await openDatabase();
            const transaction = db.transaction('images', 'readwrite');
            const store = transaction.objectStore('images');

            // Store the raw file object directly under a fixed key
            store.put(file, 'selectedImage');

            transaction.oncomplete = function() {
                // Instantly jump over to the editing page!
                window.location.href = 'Photo Editor/photo_editor.html';
            };
        } catch (error) {
            console.error("IndexedDB Save Failed:", error);
            alert("Failed to save image locally. Please try again.");
        }
    }
});