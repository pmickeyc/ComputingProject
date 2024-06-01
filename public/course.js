$(document).ready(function () {
    const urlPath = window.location.pathname;
    const courseId = urlPath.substring(urlPath.lastIndexOf('/') + 1); // Extract courseId from URL
    console.log(`Course ID: ${courseId}`); // Log course ID

    fetchCourseContents(courseId);

    function fetchCourseContents(courseId) {
        $.ajax({
            url: `/api/course/${courseId}/contents`, // Update this URL based on your actual endpoint
            method: 'GET',
            success: function (data) {
                console.log('Course contents data:', data); // Log the retrieved data
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
                <td>${content.CoursePDF ? 'PDF Available' : 'N/A'}</td>
                <td>${content.EmailID || 'N/A'}</td>
                <td>${content.ContentType || 'N/A'}</td>
                <td>
                    <button class="btn btn-secondary view-content" data-id="${content.ContentID}" data-type="${content.ContentType}" data-pdf="${content.CoursePDF}" data-email-id="${content.EmailID}">View</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        document.querySelectorAll('.view-content').forEach(button => {
            button.addEventListener('click', function () {
                const contentId = this.getAttribute('data-id');
                const contentType = this.getAttribute('data-type');
                const pdfPath = this.getAttribute('data-pdf') ? this.getAttribute('data-pdf').replace('./public/', '/') : null; // Correcting the path
                const emailId = this.getAttribute('data-email-id');
                console.log(`Button clicked: Content ID: ${contentId}, Content Type: ${contentType}, PDF Path: ${pdfPath}, Email ID: ${emailId}`); // Log button click event
                if (contentType === 'PDF') {
                    // Load PDF content
                    console.log(`Loading PDF: ${pdfPath}`); // Log the PDF path
                    loadPDF(pdfPath);
                } else if (contentType === 'Email') {
                    // Redirect to email content
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
                const viewerContainer = document.getElementById('pdf-viewer');
                viewerContainer.innerHTML = ''; // Clear existing content

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                viewerContainer.appendChild(canvas);

                const scale = viewerContainer.offsetWidth / page.getViewport({ scale: 1 }).width;
                const viewport = page.getViewport({ scale: scale });

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
});
