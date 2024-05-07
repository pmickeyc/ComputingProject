/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform

TODO:
Make this dynamic to each individual course rather than hardcoded
*/

$(document).ready(function () {
    const urlPath = window.location.pathname;
    const courseId = urlPath.substring(urlPath.lastIndexOf('/') + 1); // Extract courseId from URL

    let pdfDoc = null,
        pageNum = 1,
        scale = 1.0;

    function renderPage(num) {
        pdfDoc.getPage(num).then(function (page) {
            const viewerContainer = document.getElementById('pdf-viewer');
            viewerContainer.innerHTML = ''; // Clear existing content

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            viewerContainer.appendChild(canvas);

            // Calculate scale based on the container width and the width of the PDF page
            const scale = viewerContainer.offsetWidth / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale: scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            // Render the page
            page.render(renderContext).promise.then(() => {
                console.log(`Rendered page number ${num}`);
            }).catch(error => {
                console.error(`Error rendering page ${num}:`, error);
            });
        });

        // Update page counters
        document.getElementById('page_num').textContent = num;
    }

    function queueRenderPage(num) {
        if (pdfDoc !== null) {
            renderPage(num);
        }
    }

    function onPrevPage() {
        if (pageNum <= 1) {
            return;
        }
        pageNum--;
        queueRenderPage(pageNum);
    }

    function onNextPage() {
        if (pageNum >= pdfDoc.numPages) {
            return;
        }
        pageNum++;
        queueRenderPage(pageNum);
    }

    document.getElementById('prev').addEventListener('click', onPrevPage);
    document.getElementById('next').addEventListener('click', onNextPage);

    // Load PDF
    $.ajax({
        url: `/files/pdf/${courseId}`, // Fetch PDF using dynamic courseId
        method: 'GET',
        xhrFields: {
            responseType: 'blob' // Set response type as blob
        },
        success: function (blob) {
            const pdfUrl = URL.createObjectURL(blob);
            pdfjsLib.getDocument(pdfUrl).promise.then(function (pdfDoc_) {
                pdfDoc = pdfDoc_;
                document.getElementById('page_count').textContent = pdfDoc.numPages;

                // Initial/first page rendering
                renderPage(pageNum);
            }).catch(function (error) {
                console.error('Error loading PDF:', error);
                alert('Failed to load PDF.');
            });
        },
        error: function (xhr, status, error) {
            console.error("Failed to retrieve PDF:", status, error);
            alert('Failed to retrieve PDF URL.');
        }
    });
});
