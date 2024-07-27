// add event listener for when the document is fully loaded
$(document).ready(function () {
    // get url path and extract courseId from it
    const urlPath = window.location.pathname;
    const courseId = urlPath.substring(urlPath.lastIndexOf('/') + 1); // extract courseId from url
    console.log(`course id: ${courseId}`); // log course id

    let selectedContentId = null; // variable to store the selected contentid

    // fetch course contents
    fetchCourseContents(courseId);

    // event listener for the back button
    document.getElementById('back-button').addEventListener('click', function () {
        location.reload();
    });

    // event listener for the complete button
    document.getElementById('complete-button').addEventListener('click', function () {
        if (selectedContentId) {
            markContentComplete(selectedContentId, courseId);
        } else {
            alert('please select content to complete.');
        }
    });

    // function to fetch course contents
    function fetchCourseContents(courseId) {
        $.ajax({
            url: `/api/course/${courseId}/contents`,
            method: 'GET',
            success: function (data) {
                console.log('course contents data:', data);
                populateCourseContentTable(data);
            },
            error: function (xhr, status, error) {
                console.error("failed to retrieve course contents:", status, error);
                alert('failed to retrieve course contents.');
            }
        });
    }

    // function to populate course content table
    function populateCourseContentTable(contents) {
        const tableBody = document.getElementById('course-content-table');
        tableBody.innerHTML = ''; // clear previous contents

        // iterate over contents array
        contents.forEach(content => {
            console.log(`content id: ${content.ContentID}, content type: ${content.ContentType}`);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${content.ContentID}</td>
                <td>${content.ContentName || 'N/A'}</td>
                <td>${content.ContentDescription || 'N/A'}</td>
                <td>${content.ContentType || 'N/A'}</td>
                <td>${content.CompletionStatus}</td>
                <td>
                    <button class="btn btn-secondary view-content" data-id="${content.ContentID}" data-type="${content.ContentType}" data-pdf="${content.CoursePDF}" data-email-id="${content.EmailID}">view</button>
                </td>
            `;
            // append row to table body
            tableBody.appendChild(row);
        });

        // add click event listeners to view content buttons
        document.querySelectorAll('.view-content').forEach(button => {
            button.addEventListener('click', function () {
                selectedContentId = this.getAttribute('data-id');
                console.log(`selected content id: ${selectedContentId}`);
                const contentType = this.getAttribute('data-type');
                const pdfPath = this.getAttribute('data-pdf') ? this.getAttribute('data-pdf').replace('./public/', '/') : null;
                const emailId = this.getAttribute('data-email-id');
                console.log(`button clicked: content id: ${selectedContentId}, content type: ${contentType}, pdf path: ${pdfPath}, email id: ${emailId}`);
                if (contentType === 'PDF') {
                    loadPDF(pdfPath);
                } else if (contentType === 'Email') {
                    window.location.href = `/email/${emailId}`;
                }
            });
        });
    }

    // function to load pdf
    function loadPDF(pdfPath) {
        console.log(`loading pdf from path: ${pdfPath}`); // log the pdf path

        const courseContent = $('#course-content');
        const emailContent = $('#email-content');
        const pdfViewer = $('#pdf-viewer');

        // hide course content and email content, show pdf viewer
        if (courseContent.length) {
            console.log("hiding #course-content");
            courseContent.hide();
        } else {
            console.error("#course-content not found");
        }
        if (emailContent.length) {
            console.log("hiding #email-content");
            emailContent.hide();
        } else {
            console.error("#email-content not found");
        }
        if (pdfViewer.length) {
            console.log("showing #pdf-viewer");
            pdfViewer.show();
        } else {
            console.error("#pdf-viewer not found");
        }

        let pdfDoc = null,
            pageNum = 1;

        // function to render page
        function renderPage(num) {
            pdfDoc.getPage(num).then(function (page) {
                const canvas = document.getElementById('pdf-canvas');
                const context = canvas.getContext('2d');
                const scale = canvas.parentElement.offsetWidth / page.getViewport({ scale: 1 }).width;
                const viewport = page.getViewport({ scale: scale });

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                page.render(renderContext).promise.then(() => {
                    console.log(`rendered page number ${num}`);
                }).catch(error => {
                    console.error(`error rendering page ${num}:`, error);
                });
            });

            document.getElementById('page_num').textContent = num;
        }

        // function to queue render page
        function queueRenderPage(num) {
            if (pdfDoc !== null) {
                renderPage(num);
            }
        }

        // function to handle previous page button click
        function onPrevPage() {
            if (pageNum <= 1) {
                return;
            }
            pageNum--;
            queueRenderPage(pageNum);
        }

        // function to handle next page button click
        function onNextPage() {
            if (pageNum >= pdfDoc.numPages) {
                return;
            }
            pageNum++;
            queueRenderPage(pageNum);
        }

        // add event listeners to previous and next page buttons
        document.getElementById('prev').addEventListener('click', onPrevPage);
        document.getElementById('next').addEventListener('click', onNextPage);

        // load pdf document
        pdfjsLib.getDocument(pdfPath).promise.then(function (pdfDoc_) {
            pdfDoc = pdfDoc_;
            document.getElementById('page_count').textContent = pdfDoc.numPages;
            renderPage(pageNum);
        }).catch(function (error) {
            console.error('error loading pdf:', error);
            alert('failed to load pdf.');
        });
    }

    // function to mark content complete
    function markContentComplete(contentId, courseId) {
        // fetch csrf token
        fetch('/csrf-token')
            .then(response => response.json())
            .then(data => {
                console.log(data);
                const csrfToken = data.csrfToken; // set the csrf token value

                // proceed with marking content complete only after fetching the csrf token
                return $.ajax({
                    url: `/api/complete-content/${contentId}`,
                    method: 'POST',
                    headers: {
                        'CSRF-Token': csrfToken // include csrf token in the headers
                    },
                    data: JSON.stringify({ courseId: courseId }), // convert data to json string
                    contentType: 'application/json', // set content type to application/json
                    success: function (data) {
                        console.log('content marked as complete:', data); // log success response
                        location.reload(); // refresh the page
                    },
                    error: function (xhr, status, error) {
                        console.error("failed to mark content as complete:", status, error);
                        alert('failed to mark content as complete.');
                    }
                });
            })
            .catch(error => {
                console.error('failed to fetch csrf token', error);
            });
    }
});
