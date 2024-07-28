/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024

*/

// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // get the course id from the url
    const courseId = window.location.pathname.split('/').pop();
    // fetch details for the course
    fetchCourseDetails(courseId);
    let currentContentId = null;

    // add click event listener to the submit edit course button
    document.getElementById('submit-edit-course-btn').addEventListener('click', function (event) {
        event.preventDefault();
        submitEditCourse();
    });

    // add click event listener to the submit course content button
    document.getElementById('submit-course-content-btn').addEventListener('click', function (event) {
        event.preventDefault();
        submitCourseContent();
    });

    // add click event listener to the submit edit content button
    document.getElementById('submit-edit-content-btn').addEventListener('click', function (event) {
        event.preventDefault();
        submitEditContent();
    });

    // add click event listener to the download template button
    document.getElementById('download-template-btn').addEventListener('click', function (event) {
        event.preventDefault();
        downloadTemplate();
    });
});

// function to fetch course details
function fetchCourseDetails(courseId) {
    fetch(`/api/course/${courseId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`http error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // check if data exists
            if (data) {
                // set course title and description
                document.getElementById('course-title').value = data.course.Title;
                document.getElementById('course-description').value = data.course.Description;

                // get the content table element
                const contentTable = document.getElementById('course-content-table');
                contentTable.innerHTML = '';

                // iterate over the content array
                data.content.forEach(content => {
                    // create a new table row
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${content.ContentID}</td>
                        <td>${content.ContentName || 'null'}</td>
                        <td>${content.ContentDescription || 'null'}</td>
                        <td>${content.CoursePDF || 'null'}</td>
                        <td>${content.EmailID || 'null'}</td>
                        <td>${content.ContentType || 'null'}</td>
                        <td>
                            <button class="btn btn-secondary btn-sm" id="edit-btn-${content.ContentID}">Edit</button>
                            <button class="btn btn-danger btn-sm" id="delete-btn-${content.ContentID}">Delete</button>
                        </td>
                    `;
                    // append the row to the content table
                    contentTable.appendChild(row);

                    // add click event listener to edit button
                    document.getElementById(`edit-btn-${content.ContentID}`).addEventListener('click', function() {
                        editContent(content.ContentID);
                    });

                    // add click event listener to delete button
                    document.getElementById(`delete-btn-${content.ContentID}`).addEventListener('click', function() {
                        deleteContent(content.ContentID);
                    });
                });
            } else {
                console.error('course not found');
            }
        })
        .catch(error => {
            console.error('error fetching course details:', error);
        });
}

// function to submit course content
function submitCourseContent() {
    // get course id from url
    const courseId = window.location.pathname.split('/').pop();
    // get content name and description
    const contentName = document.getElementById('content-name').value;
    const contentDescription = document.getElementById('content-description').value;
    // get pdf and xlsx files
    const pdfFile = document.getElementById('pdf-file').files[0];
    const xlsxFile = document.getElementById('xlsx-file').files[0];

    // check if content name and description are provided
    if (!contentName || !contentDescription) {
        alert("all fields are required.");
        return;
    }

    // create content data object
    const contentData = {
        contentName: contentName,
        contentDescription: contentDescription,
        contentType: ''
    };

    // if xlsx file is provided
    if (xlsxFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            contentData.xlsxData = JSON.stringify(json);
            contentData.contentType = 'Email';

            // if pdf file is also provided
            if (pdfFile) {
                uploadPDF(pdfFile, (filePath) => {
                    contentData.pdfFile = filePath;
                    sendCourseContent(courseId, contentData);
                });
            } else {
                sendCourseContent(courseId, contentData);
            }
        };
        reader.readAsArrayBuffer(xlsxFile);
    } else if (pdfFile) {
        // if only pdf file is provided
        uploadPDF(pdfFile, (filePath) => {
            contentData.pdfFile = filePath;
            contentData.contentType = 'PDF';
            sendCourseContent(courseId, contentData);
        });
    } else {
        // if no file is provided
        sendCourseContent(courseId, contentData);
    }
}

// function to upload a pdf
function uploadPDF(file, callback) {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;

            const formData = new FormData();
            formData.append('file', file);

            fetch('/api/upload-pdf', {
                method: 'POST',
                headers: {
                    'CSRF-Token': csrfToken
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    callback(data.filePath);
                } else {
                    alert('failed to upload pdf: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error uploading pdf:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to send course content
function sendCourseContent(courseId, contentData) {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;

            fetch(`/api/course/${courseId}/content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(contentData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`http error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('course content uploaded successfully');
                    location.reload();  // refresh the page
                } else {
                    alert('failed to upload course content: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error uploading course content:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to edit content
function editContent(contentId) {
    currentContentId = contentId;

    fetch(`/api/course/content/${contentId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`http error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // set content name and description in the edit form
            document.getElementById('edit-content-name').value = data.content.ContentName || '';
            document.getElementById('edit-content-description').value = data.content.ContentDescription || '';
            $('#editContentModal').modal('show');
        })
        .catch(error => {
            console.error('error fetching content details:', error);
        });
}

// function to submit edited content
function submitEditContent() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;

            const contentName = document.getElementById('edit-content-name').value;
            const contentDescription = document.getElementById('edit-content-description').value;

            const contentData = {
                contentName: contentName,
                contentDescription: contentDescription
            };

            fetch(`/api/course/content/${currentContentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(contentData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`http error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('content updated successfully');
                    $('#editContentModal').modal('hide');
                    fetchCourseDetails(window.location.pathname.split('/').pop());  // refresh the content table
                } else {
                    alert('failed to update content: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error updating content:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to submit edited course
function submitEditCourse() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;

            const courseId = window.location.pathname.split('/').pop();
            const title = document.getElementById('course-title').value;
            const description = document.getElementById('course-description').value;

            // validation (if necessary)
            if (!title || !description) {
                alert('both title and description are required.');
                return;
            }

            const courseData = {
                title: title,
                description: description
            };

            fetch(`/api/course/${courseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(courseData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`http error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('course updated successfully');
                    window.location.href = '/admin-courses'; // redirect to courses list
                } else {
                    alert('failed to update course: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error updating course:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to delete content
function deleteContent(contentId) {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;

            const courseId = window.location.pathname.split('/').pop();

            fetch(`/api/course/content/${contentId}`, {
                method: 'DELETE',
                headers: {
                    'CSRF-Token': csrfToken
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`http error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('content deleted successfully');
                    fetchCourseDetails(courseId);  // refresh the content table
                } else {
                    alert('failed to delete content: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error deleting content:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to download the template
function downloadTemplate() {
    fetch('/download-email-template')
        .then(response => {
            if (!response.ok) {
                throw new Error(`http error! status: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'Email Upload Template.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error('error downloading template:', error);
        });
}