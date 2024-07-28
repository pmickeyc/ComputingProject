/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024

*/

// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    const gradesTableBody = document.querySelector('#grades-table tbody'); // get the grades table body

    try {
        // fetch user grades from the api
        const response = await fetch('/api/user-grades');
        const courses = await response.json();

        // iterate over courses array
        courses.forEach(course => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${course.Title}</td>
                <td>${course.Description}</td>
                <td>${course.Progress}%</td>
            `;
            // append row to grades table body
            gradesTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('error fetching course grades:', error);
    }
});
