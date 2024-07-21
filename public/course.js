$(document).ready(function () {
    const urlPath = window.location.pathname;
    const courseId = urlPath.substring(urlPath.lastIndexOf('/') + 1); // Extract courseId from URL
    console.log(`Course ID: ${courseId}`); // Log course ID

    let selectedContentId = null; // Variable to store the selected ContentID

    fetchCourseContents(courseId);

    // Event listener for the Back button
    document.getElementById('back-button').addEventListener('click', function () {
        location.reload();
    });

    // Event listener for the Complete button
    document.getElementById('complete-button').addEventListener('click', function () {
        if (selectedContentId) {
            markContentComplete(selectedContentId, courseId);
        } else {
            alert('Please select content to complete.');
        }
    });

    function fetchCourseContents(courseId) {
        $.ajax({
            url: `/api/course/${courseId}/contents`,
            method: 'GET',
            success: function (data) {
                console.log('Course contents data:', data);
                populateCourseContentTable(data);
            },
            error: function (xhr, status, error) {
                console.error("Failed to retrieve course contents:", status, error);
                alert('Failed to retrieve course contents.');
            }
        });
    }

    function populateCourseContentTable(contents) {
        const tableBody = document.getElementById('course-content-table');
        tableBody.innerHTML = '';

        contents.forEach(content => {
            console.log(`Content ID: ${content.ContentID}, Content Type: ${content.ContentType}`);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${content.ContentID}</td>
                <td>${content.ContentName || 'N/A'}</td>
                <td>${content.ContentDescription || 'N/A'}</td>
                <td>${content.ContentType || 'N/A'}</td>
                <td>${content.CompletionStatus}</td>
                <td>
                    <button class="btn btn-secondary view-content" data-id="${content.ContentID}" data-type="${content.ContentType}" data-pdf="${content.CoursePDF}" data-email-id="${content.EmailID}">View</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        document.querySelectorAll('.view-content').forEach(button => {
            button.addEventListener('click', function () {
                selectedContentId = this.getAttribute('data-id');
                console.log(`Selected Content ID: ${selectedContentId}`);
                const contentType = this.getAttribute('data-type');
                const pdfPath = this.getAttribute('data-pdf') ? this.getAttribute('data-pdf').replace('./public/', '/') : null;
                const emailId = this.getAttribute('data-email-id');
                console.log(`Button clicked: Content ID: ${selectedContentId}, Content Type: ${contentType}, PDF Path: ${pdfPath}, Email ID: ${emailId}`);
                if (contentType === 'PDF') {
                    loadPDF(pdfPath);
                } else if (contentType === 'Email') {
                    window.location.href = `/email/${emailId}`;
                }
            });
        });
    }


    function loadPDF(pdfPath) {
        console.log(`Loading PDF from path: ${pdfPath}`); // Log the PDF path

        const courseContent = $('#course-content');
        const emailContent = $('#email-content');
        const pdfViewer = $('#pdf-viewer');

        if (courseContent.length) {
            console.log("Hiding #course-content");
            courseContent.hide();
        } else {
            console.error("#course-content not found");
        }
        if (emailContent.length) {
            console.log("Hiding #email-content");
            emailContent.hide();
        } else {
            console.error("#email-content not found");
        }
        if (pdfViewer.length) {
            console.log("Showing #pdf-viewer");
            pdfViewer.show();
        } else {
            console.error("#pdf-viewer not found");
        }

        let pdfDoc = null,
            pageNum = 1;

        function renderPage(num) {
            pdfDoc.getPage(num).then(function (page) {
                const canvas = document.getElementById('pdf-canvas');
                const context = canvas.getContext('2d');
                const scale = canvas.parentElement.offsetWidth / page.getViewport({
                    scale: 1
                }).width;
                const viewport = page.getViewport({
                    scale: scale
                });

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                page.render(renderContext).promise.then(() => {
                    console.log(`Rendered page number ${num}`);
                }).catch(error => {
                    console.error(`Error rendering page ${num}:`, error);
                });
            });

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

        pdfjsLib.getDocument(pdfPath).promise.then(function (pdfDoc_) {
            pdfDoc = pdfDoc_;
            document.getElementById('page_count').textContent = pdfDoc.numPages;
            renderPage(pageNum);
        }).catch(function (error) {
            console.error('Error loading PDF:', error);
            alert('Failed to load PDF.');
        });
    }

    function markContentComplete(contentId, courseId) {
        // Fetch CSRF token
        fetch('/csrf-token')
            .then(response => response.json())
            .then(data => {
                console.log(data);
                const csrfToken = data.csrfToken; // Set the CSRF token value

                // Proceed with marking content complete only after fetching the CSRF token
                return $.ajax({
                    url: `/api/complete-content/${contentId}`,
                    method: 'POST',
                    headers: {
                        'CSRF-Token': csrfToken // Include CSRF token in the headers
                    },
                    data: JSON.stringify({
                        courseId: courseId
                    }), // Convert data to JSON string
                    contentType: 'application/json', // Set content type to application/json
                    success: function (data) {
                        console.log('Content marked as complete:', data); // Log success response
                        location.reload(); // Refresh the page
                    },
                    error: function (xhr, status, error) {
                        console.error("Failed to mark content as complete:", status, error);
                        alert('Failed to mark content as complete.');
                    }
                });
            })
            .catch(error => {
                console.error('Failed to fetch CSRF token', error);
            });
    }

});