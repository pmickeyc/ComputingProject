document.addEventListener('DOMContentLoaded', function() {
    const courseId = window.location.pathname.split('/').pop();
    fetchCourseDetails(courseId);
    let currentContentId = null;
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
                            <button class="btn btn-secondary btn-sm" onclick="editContent(${content.ContentID})">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteContent(${content.ContentID})">Delete</button>
                        </td>
                    `;
                    contentTable.appendChild(row);
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
    const xlsxFile = document.getElementById('xlsx-file').files[0];
    
    const contentData = {
        contentName: contentName,
        contentDescription: contentDescription,
        contentType: xlsxFile ? 'Email' : 'PDF'
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

            // Log the contentData
            console.log('Sending content data:', contentData);

            sendCourseContent(courseId, contentData);
        };
        reader.readAsArrayBuffer(xlsxFile);
    } else {
        // Log the contentData
        console.log('Sending content data:', contentData);

        sendCourseContent(courseId, contentData);
    }
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
