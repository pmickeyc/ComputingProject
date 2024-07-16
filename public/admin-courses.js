document.addEventListener('DOMContentLoaded', function () {
    fetchAllCourses();
    const createCourseBtn = document.getElementById('create-course-btn');
    if (createCourseBtn) {
        createCourseBtn.addEventListener('click', function (event) {
            event.preventDefault();
            document.getElementById('createCourseModal').style.display = 'block';
        });
    }
});

function fetchAllCourses() {
    fetch('/api/admin/all-courses')
        .then(response => response.json())
        .then(data => {
            populateCourses(data, '#admin-courses-container');
        })
        .catch(error => {
            console.error('Error fetching all courses for admin:', error);
            document.querySelector('#admin-courses-container').innerHTML = '<p class="text-danger">Failed to load courses.</p>';
        });
}

function populateCourses(courses, containerSelector) {
    const container = document.querySelector(containerSelector);
    container.innerHTML = '';
    courses.forEach(course => {
        const courseElement = document.createElement('div');
        courseElement.className = 'col-md-4';
        courseElement.innerHTML = `
            <div class="course-tile">
                <h4>${course.Title}</h4>
                <p>${course.Description}</p>
                <button onclick="editCourse(${course.CourseID})" class="btn btn-secondary">Edit</button>
                <button onclick="deleteCourse(${course.CourseID})" class="btn btn-danger">Delete</button>
            </div>
        `;
        container.appendChild(courseElement);
    });
}

function editCourse(courseId) {
    console.log('Editing course', courseId);
    window.location.href = `/admin-courses/${courseId}`;
}

function deleteCourse(courseId) {
    console.log('Deleting course', courseId);
    fetch(`/api/course/${courseId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Course deleted successfully');
            location.reload(); // Optionally reload the page or refresh the course list
        } else {
            alert('Failed to delete course: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error deleting course:', error);
    });
}


function closeCreateCourseModal() {
    document.getElementById('createCourseModal').style.display = 'none';
}

function submitCourse() {
    const title = document.getElementById('course-name').value;
    const description = document.getElementById('course-description').value;

    // Simple validation
    if (!title || !description) {
        alert("All fields are required.");
        return;
    }

    // Create course data
    const courseData = {
        title: title,
        description: description
    };

    sendCourseData(courseData);
    console.log(courseData);
}

function sendCourseData(courseData) {
    fetch('/api/create-course', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(courseData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Course created successfully');
            location.reload(); // Optionally reload the page or refresh the course list
            closeCreateCourseModal();
        } else {
            alert('Failed to create course: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error creating course:', error);
    });
}
