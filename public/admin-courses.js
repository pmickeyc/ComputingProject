/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024

*/

// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // fetch all courses
    fetchAllCourses();
    
    // get create course button
    const createCourseBtn = document.getElementById('create-course-btn');
    if (createCourseBtn) {
        // add click event listener to create course button
        createCourseBtn.addEventListener('click', function (event) {
            event.preventDefault();
            document.getElementById('createCourseModal').style.display = 'block';
        });
    }

    // get submit course button
    const submitCourseBtn = document.getElementById('submit-course-btn');
    if (submitCourseBtn) {
        // add click event listener to submit course button
        submitCourseBtn.addEventListener('click', function (event) {
            event.preventDefault();
            submitCourse();
        });
    }

    // get close create course modal button
    const closeCreateCourseModalBtn = document.getElementById('close-create-course-modal-btn');
    if (closeCreateCourseModalBtn) {
        // add click event listener to close create course modal button
        closeCreateCourseModalBtn.addEventListener('click', function (event) {
            event.preventDefault();
            closeCreateCourseModal();
        });
    }
});

// function to fetch all courses
function fetchAllCourses() {
    fetch('/api/admin/all-courses')
        .then(response => response.json())
        .then(data => {
            // populate courses in the container
            populateCourses(data, '#admin-courses-container');
        })
        .catch(error => {
            console.error('error fetching all courses for admin:', error);
            document.querySelector('#admin-courses-container').innerHTML = '<p class="text-danger">failed to load courses.</p>';
        });
}

// function to populate courses in a container
function populateCourses(courses, containerSelector) {
    const container = document.querySelector(containerSelector);
    container.innerHTML = '';
    // iterate over courses array
    courses.forEach(course => {
        const courseElement = document.createElement('div');
        courseElement.className = 'col-md-4';
        courseElement.innerHTML = `
            <div class="course-tile">
                <h4>${course.Title}</h4>
                <p>${course.Description}</p>
                <button class="btn btn-secondary" id="edit-btn-${course.CourseID}">Edit</button>
                <button class="btn btn-danger" id="delete-btn-${course.CourseID}">Delete</button>
            </div>
        `;
        // append course element to container
        container.appendChild(courseElement);

        // add click event listener to edit button
        document.getElementById(`edit-btn-${course.CourseID}`).addEventListener('click', function () {
            editCourse(course.CourseID);
        });

        // add click event listener to delete button
        document.getElementById(`delete-btn-${course.CourseID}`).addEventListener('click', function () {
            deleteCourse(course.CourseID);
        });
    });
}

// function to edit a course
function editCourse(courseId) {
    console.log('editing course', courseId);
    window.location.href = `/admin-courses/${courseId}`;
}

// function to delete a course
function deleteCourse(courseId) {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // set the csrf token value

            console.log('deleting course', courseId);
            fetch(`/api/course/${courseId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('course deleted successfully');
                    location.reload(); 
                } else {
                    alert('failed to delete course: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error deleting course:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to close create course modal
function closeCreateCourseModal() {
    document.getElementById('createCourseModal').style.display = 'none';
}

// function to submit a new course
function submitCourse() {
    const title = document.getElementById('course-name').value;
    const description = document.getElementById('course-description').value;

    // simple validation
    if (!title || !description) {
        alert("all fields are required.");
        return;
    }

    // create course data object
    const courseData = {
        title: title,
        description: description
    };

    sendCourseData(courseData);
    console.log(courseData);
}

// function to send course data to the server
function sendCourseData(courseData) {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // set the csrf token value

            fetch('/api/create-course', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(courseData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`network response was not ok: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('course created successfully');
                    location.reload(); // optionally reload the page or refresh the course list
                    closeCreateCourseModal();
                } else {
                    alert('failed to create course: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error creating course:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}
