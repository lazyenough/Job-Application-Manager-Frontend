// const API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = "https://job-application-manager-xfxz.onrender.com";

// Dom Element Selectors (Only including active elements present in index.html)
const ingestBtn = document.getElementById("ingestBtn");
const jobUrlInput = document.getElementById("jobUrl"); // Matches index.html input id

const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");
const jobsContainer = document.getElementById("jobsContainer"); // Target container
const previewModal = document.getElementById("previewModal");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const saveModalBtn = document.getElementById("saveModalBtn");

// Modal Input Selectors
const editJobTitle = document.getElementById("editJobTitle");
const editCompany = document.getElementById("editCompany");
const editLocation = document.getElementById("editLocation");
const editWorkMode = document.getElementById("editWorkMode");
const editReqExp = document.getElementById("editReqExp");
const editSkills = document.getElementById("editSkills");
const hiddenJobUrl = document.getElementById("hiddenJobUrl");
const hiddenJobDesc = document.getElementById("hiddenJobDesc");

function resetMessages() {
    errorBox.style.display = "none";
    successBox.style.display = "none";
}

// Fixed target to populate the container in index.html layout
function renderSavedJobs(jobs) {
    if (!jobs || !jobs.length) {
        jobsContainer.innerHTML = '<p class="job-meta-text" style="padding: 2rem; text-align: center;">No saved jobs found.</p>';
        return;
    }

    jobsContainer.innerHTML = jobs.map(job => {
        const postedDate = job.date_posted ? new Date(job.date_posted).toLocaleDateString() : 'Date unknown';
        const reqExperience = job.job_summary?.required_experience ?? "Not specified";
        const skillsList = job.job_summary?.key_skills?.length ? job.job_summary.key_skills.join(", ") : "None extracted";

        return `
        <div class="job-item">
            <!-- Primary Row Layout -->
            <div class="job-primary">
                <div>
                    <h3 class="job-title-text">${job.job_title ?? "Untitled Role"}</h3>
                    <p class="job-company-text">
                        ${job.company_name ?? "Unknown Company"} • ${job.location ?? "Remote / Unspecified"}
                    </p>
                </div>
                <span class="job-status">${job.status ?? "saved"}</span>
            </div>

            <!-- Metadata Row -->
            <p class="job-meta-text">
                <a href="${job.job_url}" target="_blank" class="job-listing-link">View Original Listing ↗</a>
            </p>

            <!-- AI Job Summary Insights Wrapper -->
            <div class="ai-insights">
                <p><strong>Required Experience:</strong> ${reqExperience}</p>
                <p><strong>Key Skills:</strong> <span class="ai-skills-highlight">${skillsList}</span></p>
            </div>

            <!-- Native Expandable Layout Container -->
            ${job.job_description ? `
                <details class="job-description-details">
                    <summary>View Full Job Description</summary>
                    <div class="job-description-content">${job.job_description}</div>
                </details>
            ` : ''}
            
            <!-- Controls Modification Row -->
            <div class="status-update-row">
                <select id="status-${job.id}" class="status-select-dropdown">
                    <option value="saved" ${job.status === "saved" ? "selected" : ""}>saved</option>
                    <option value="to_apply" ${job.status === "to_apply" ? "selected" : ""}>to_apply</option>
                    <option value="applied" ${job.status === "applied" ? "selected" : ""}>applied</option>
                    <option value="interview" ${job.status === "interview" ? "selected" : ""}>interview</option>
                    <option value="offer" ${job.status === "offer" ? "selected" : ""}>offer</option>
                    <option value="rejected" ${job.status === "rejected" ? "selected" : ""}>rejected</option>
                    <option value="archived" ${job.status === "archived" ? "selected" : ""}>archived</option>
                </select>
                <button onclick="updateJobStatus('${job.id}')" class="action-btn-update">Update</button>
                <button onclick="deleteJob('${job.id}')" class="action-btn-delete">Delete</button>
            </div>
        </div>
        `;
    }).join("");
}

// Fetch Initial Pipeline Data (Loads top 5 jobs at startup)
async function loadInitialJobs() {
    try {
        // Calls the backend pipeline
        const response = await fetch(`${API_BASE_URL}/jobs`);
        if (response.ok) {
            let data = await response.json();
            // Slice the array payload down to a max of top 5 elements
            const topFiveJobs = data.slice(0, 5);
            renderSavedJobs(topFiveJobs);
        }
    } catch (error) {
        console.error("Failed to load initial job dashboard cards:", error);
    }
}

// Ingestion Processing Handler
ingestBtn.addEventListener("click", async () => {
    const jobUrl = jobUrlInput.value.trim();
    resetMessages();

    if (!jobUrl) {
        errorBox.textContent = "Please enter a job URL.";
        errorBox.style.display = "block";
        return;
    }

    ingestBtn.disabled = true;
    ingestBtn.textContent = "Extracting details...";

    try {
        // Hitting your preview endpoint instead of saving directly
        const response = await fetch(`${API_BASE_URL}/jobs/ingest/preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_url: jobUrl })
        });

        let data;
        try { data = await response.json(); } catch (e) {
            throw new Error("API did not return valid JSON.");
        }

        if (!response.ok) {
            throw new Error(data.detail || "Something went wrong while previewing the job.");
        }

        // Populate Modal Fields with extracted data
        editJobTitle.value = data.job_title ?? "";
        editCompany.value = data.company_name ?? "";
        editLocation.value = data.location ?? "";
        editWorkMode.value = data.work_mode ?? "";
        
        if (data.job_summary) {
            editReqExp.value = data.job_summary.required_experience ?? "";
            editSkills.value = data.job_summary.key_skills ? data.job_summary.key_skills.join(", ") : "";
        } else {
            editReqExp.value = "";
            editSkills.value = "";
        }

        // Store hidden fields to persist them
        hiddenJobUrl.value = jobUrl;
        hiddenJobDesc.value = data.job_description || data.job_description_preview || "";

        // Show Modal
        previewModal.style.display = "flex";

    } catch (error) {
        errorBox.textContent = error.message || "Something went wrong while calling the API.";
        errorBox.style.display = "block";
    } finally {
        ingestBtn.disabled = false;
        ingestBtn.textContent = "Ingest Job";
    }
});

// 2. Modal Cancel Action
cancelModalBtn.addEventListener("click", () => {
    previewModal.style.display = "none";
});

// 3. Modal Save Action (Saves edited data to DB)
saveModalBtn.addEventListener("click", async () => {
    // 1. Ensure the URL has http:// or https:// for Pydantic's HttpUrl
    let rawUrl = hiddenJobUrl.value.trim();
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
        rawUrl = "https://" + rawUrl; 
    }

    // 2. Convert the comma-separated string back into a clean array of strings
    const rawSkills = editSkills.value.split(",")
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);

    // 3. Construct the payload to exactly match JobCreate schema
    const editedJobData = {
        job_url: rawUrl,
        job_title: editJobTitle.value.trim() || null,
        company_name: editCompany.value.trim() || null,
        location: editLocation.value.trim() || null,
        work_mode: editWorkMode.value.trim() || null,
        job_description: hiddenJobDesc.value.trim() || null,
        job_summary: {
            required_experience: editReqExp.value.trim() || null,
            key_skills: rawSkills.length > 0 ? rawSkills : null 
        }
    };

    try {
        // 4. Send directly without the { job_data: ... } wrapper
        const response = await fetch(`${API_BASE_URL}/jobs/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editedJobData) 
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Validation Error Details:", errorData);
            throw new Error(errorData.detail || "Failed to save job.");
        }

        const data = await response.json();
        alert("Job successfully saved!");
        previewModal.style.display = "none";

        await loadInitialJobs();
        
    } catch (error) {
        alert(error.message);
    }
});

// Status Modifiers
async function updateJobStatus(jobId) {
    const statusSelect = document.getElementById(`status-${jobId}`);
    const newStatus = statusSelect.value;
    resetMessages();

    try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            successBox.textContent = "Status updated successfully.";
            successBox.style.display = "block";
            await loadInitialJobs();
        } else {
            const data = await response.json();
            errorBox.textContent = data.detail || "Status modify failed.";
            errorBox.style.display = "block";
        }
    } catch (error) {
        errorBox.textContent = "Error communicating status updates.";
        errorBox.style.display = "block";
    }
}

async function deleteJob(jobId) {
    if (!confirm("Are you sure you want to delete this job?")) return;
    resetMessages();

    try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, { method: "DELETE" });
        if (response.ok) {
            successBox.textContent = "Job removed successfully.";
            successBox.style.display = "block";
            await loadInitialJobs();
        }
    } catch (error) {
        errorBox.textContent = "Error executing job extraction deletion.";
        errorBox.style.display = "block";
    }
}

// RUN AUTOMATICALLY ON LOAD
window.addEventListener("DOMContentLoaded", loadInitialJobs);