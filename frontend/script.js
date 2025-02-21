document.getElementById('add-task').addEventListener('click', function() {
    const taskName = document.getElementById('task-name').value;
    if (taskName) {
        const taskList = document.getElementById('task-list');
        const taskItem = document.createElement('div');
        taskItem.classList.add('task-item');
        taskItem.innerHTML = `<p>${taskName}</p><button class="remove-task">Remove</button>`;
        
        taskItem.querySelector('.remove-task').addEventListener('click', function() {
            taskList.removeChild(taskItem);
        });

        taskList.appendChild(taskItem);
        document.getElementById('task-name').value = '';
    }
});


