document.addEventListener('DOMContentLoaded', function() {
    const courseId = window.location.pathname.split('/').pop();
    fetchCourseDetails(courseId);
    let currentContentId = null;

    document.getElementById('submit-edit-course-btn').addEventListener('click', function (event) {
        event.preventDefault();
        submitEditCourse();
    });

    document.getElementById('submit-course-content-btn').addEventListener('click', function (event) {
        event.preventDefault();
        submitCourseContent();
    });

    document.getElementById('submit-edit-content-btn').addEventListener('click', function (event) {
        event.preventDefault();
        submitEditContent();
    });
});

function fetchCourseDetails(courseId) {
    fetch(`/api/course/${courseId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data) {
                document.getElementById('course-title').value = data.course.Title;
                document.getElementById('course-description').value = data.course.Description;

                const contentTable = document.getElementById('course-content-table');
                contentTable.innerHTML = '';

                data.content.forEach(content => {
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
                    contentTable.appendChild(row);

                    document.getElementById(`edit-btn-${content.ContentID}`).addEventListener('click', function() {
                        editContent(content.ContentID);
                    });

                    document.getElementById(`delete-btn-${content.ContentID}`).addEventListener('click', function() {
                        deleteContent(content.ContentID);
                    });
                });
            } else {
                console.error('Course not found');
            }
        })
        .catch(error => {
            console.error('Error fetching course details:', error);
        });
}

function submitCourseContent() {
    const courseId = window.location.pathname.split('/').pop();
    const contentName = document.getElementById('content-name').value;
    const contentDescription = document.getElementById('content-description').value;
    const pdfFile = document.getElementById('pdf-file').files[0];
    const xlsxFile = document.getElementById('xlsx-file').files[0];

    if (!contentName || !contentDescription) {
        alert("All fields are required.");
        return;
    }

    const contentData = {
        contentName: contentName,
        contentDescription: contentDescription,
        contentType: ''
    };

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
        uploadPDF(pdfFile, (filePath) => {
            contentData.pdfFile = filePath;
            contentData.contentType = 'PDF';
            sendCourseContent(courseId, contentData);
        });
    } else {
        // No file uploaded
        sendCourseContent(courseId, contentData);
    }
}

function uploadPDF(file, callback) {
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            callback(data.filePath);
        } else {
            alert('Failed to upload PDF: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error uploading PDF:', error);
    });
}

function sendCourseContent(courseId, contentData) {
    fetch(`/api/course/${courseId}/content`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(contentData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Course content uploaded successfully');
            fetchCourseDetails(courseId);  // Refresh the content table
        } else {
            alert('Failed to upload course content: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error uploading course content:', error);
    });
}

function editContent(contentId) {
    currentContentId = contentId;

    fetch(`/api/course/content/${contentId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('edit-content-name').value = data.content.ContentName || '';
            document.getElementById('edit-content-description').value = data.content.ContentDescription || '';
            $('#editContentModal').modal('show');
        })
        .catch(error => {
            console.error('Error fetching content details:', error);
        });
}

function submitEditContent() {
    const contentName = document.getElementById('edit-content-name').value;
    const contentDescription = document.getElementById('edit-content-description').value;

    const contentData = {
        contentName: contentName,
        contentDescription: contentDescription
    };

    fetch(`/api/course/content/${currentContentId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(contentData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Content updated successfully');
            $('#editContentModal').modal('hide');
            fetchCourseDetails(window.location.pathname.split('/').pop());  // Refresh the content table
        } else {
            alert('Failed to update content: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error updating content:', error);
    });
}

function submitEditCourse() {
    const courseId = window.location.pathname.split('/').pop();
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-description').value;

    // Validation (if necessary)
    if (!title || !description) {
        alert('Both title and description are required.');
        return;
    }

    const courseData = {
        title: title,
        description: description
    };

    fetch(`/api/course/${courseId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(courseData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Course updated successfully');
            window.location.href = '/admin-courses'; // Redirect to courses list
        } else {
            alert('Failed to update course: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error updating course:', error);
    });
}

function deleteContent(contentId) {
    const courseId = window.location.pathname.split('/').pop();

    fetch(`/api/course/content/${contentId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Content deleted successfully');
            fetchCourseDetails(courseId);  // Refresh the content table
        } else {
            alert('Failed to delete content: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error deleting content:', error);
    });
}
