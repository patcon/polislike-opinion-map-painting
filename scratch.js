  // comment z-scores
  useEffect(() => {
    // Only run if we have data to analyze AND groups have been identified
    if (
      !voteMatrix ||
      voteMatrix.length === 0 ||
      !commentTexts ||
      commentTexts.length === 0 ||
      !groups ||
      groups.length === 0
    ) {
      setPolisStats(null)
      return
    }

    // Create arrays to store top comments for agreement and disagreement
    let topAgreeComments = []
    let topDisagreeComments = []

    // Create an object to store z-scores for ALL comments
    const allCommentZScores = {}

    // Process each comment - calculate stats for ALL comments
    commentTexts.forEach((comment, commentIndex) => {
      // Initialize counters
      let agrees = 0
      let disagrees = 0
      let passes = 0
      let totalSeen = 0

      // Count votes for this comment
      voteMatrix.forEach((participantVotes) => {
        const vote = participantVotes[commentIndex]

        // Only count non-null votes as "seen"
        if (vote !== null) {
          totalSeen++

          if (vote === 1) agrees++
          else if (vote === -1) disagrees++
          else if (vote === 0) passes++
        }
      })
      const agreementProb = (agrees + 1) / (totalSeen + 2)
      const disagreementProb = (disagrees + 1) / (totalSeen + 2)

      const agreementZScore = propTest(agrees, totalSeen)
      const disagreementZScore = propTest(disagrees, totalSeen)

      const isAgreeSignificant = zSig90(agreementZScore)
      const isDisagreeSignificant = zSig90(disagreementZScore)

      const agreementMetric = agreementProb * agreementZScore
      const disagreementMetric = disagreementProb * disagreementZScore

      const commentStat = {
        id: comment.id,
        commentIndex,
        text: comment.text,
        numAgrees: agrees,
        numDisagrees: disagrees,
        numPasses: passes,
        numSeen: totalSeen,
        agreementProb,
        disagreementProb,
        agreementZScore,
        disagreementZScore,
        agreementMetric,
        disagreementMetric,
        isAgreeSignificant,
        isDisagreeSignificant,
      }

      // Store z-scores for ALL comments
      allCommentZScores[commentIndex] = {
        agreementZScore,
        disagreementZScore,
        isAgreeSignificant,
        isDisagreeSignificant,
      }

      // Check for agreement significance
      if (agreementProb > 0.5 && isAgreeSignificant) {
        // Add to top agree comments if eligible
        if (topAgreeComments.length < 5) {
          topAgreeComments.push(commentStat)
          // Sort by agreement metric (highest first)
          topAgreeComments.sort((a, b) => b.agreementMetric - a.agreementMetric)
        } else if (agreementMetric > topAgreeComments[4].agreementMetric) {
          // Replace lowest entry if this one has higher metric
          topAgreeComments[4] = commentStat
          // Re-sort the array
          topAgreeComments.sort((a, b) => b.agreementMetric - a.agreementMetric)
        }
      }

      // Check for disagreement significance
      if (disagreementProb > 0.5 && isDisagreeSignificant) {
        // Add to top disagree comments if eligible
        if (topDisagreeComments.length < 5) {
          topDisagreeComments.push(commentStat)
          // Sort by disagreement metric (highest first)
          topDisagreeComments.sort(
            (a, b) => b.disagreementMetric - a.disagreementMetric,
          )
        } else if (
          disagreementMetric > topDisagreeComments[4].disagreementMetric
        ) {
          // Replace lowest entry if this one has higher metric
          topDisagreeComments[4] = commentStat
          // Re-sort the array
          topDisagreeComments.sort(
            (a, b) => b.disagreementMetric - a.disagreementMetric,
          )
        }
      }
    })

    // Store the top comments and ALL z-scores in the state
    const statsData = {
      consensusComments: {
        agree: topAgreeComments,
        disagree: topDisagreeComments,
      },
      zScores: allCommentZScores,
    }

    setPolisStats(statsData)
    console.log("Polis stats calculated:", statsData)
  }, [voteMatrix, commentTexts, groups])


// group z-scores, group repness scores
  useEffect(() => {
    if (!polisStats || !groups || groups.length === 0) {
      return
    }

    try {
      const commentStatsWithTid: Array<[number, Record<string, any>]> = []
      const groupSpecificZScores: Record<
        number,
        Record<number, GroupZScoreData>
      > = {}

      commentTexts.forEach((comment, commentIndex) => {
        const commentStats = {}
        groupSpecificZScores[commentIndex] = {}

        /**
         * Group z-scores
         */
        groups.forEach((group, groupIndex) => {
          let agrees = 0
          let disagrees = 0
          let passes = 0
          let totalSeen = 0

          group.points.forEach((participantIndex) => {
            const vote = voteMatrix[participantIndex][commentIndex]
            if (vote !== null) {
              totalSeen++
              if (vote === 1) agrees++
              else if (vote === -1) disagrees++
              else if (vote === 0) passes++
            }
          })

          const agreementProb = (agrees + 1) / (totalSeen + 2)
          const disagreementProb = (disagrees + 1) / (totalSeen + 2)
          const agreementZScore = propTest(agrees, totalSeen)
          const disagreementZScore = propTest(disagrees, totalSeen)
          const isAgreeSignificant = zSig90(agreementZScore)
          const isDisagreeSignificant = zSig90(disagreementZScore)

          groupSpecificZScores[commentIndex][groupIndex] = {
            agreementZScore,
            disagreementZScore,
            isAgreeSignificant,
            isDisagreeSignificant,
            agrees,
            disagrees,
            passes,
            totalSeen,
          }
          commentStats[groupIndex] = {
            na: agrees,
            nd: disagrees,
            ns: totalSeen,
            pa: agreementProb,
            pd: disagreementProb,
            pat: polisStats.zScores[commentIndex]?.agreementZScore || 0,
            pdt: polisStats.zScores[commentIndex]?.disagreementZScore || 0,
          }
        })
        commentStatsWithTid.push([commentIndex, commentStats])
      })

      setGroupZScores(groupSpecificZScores)

      /**
       * Group repness scores
       */
      // Get comparative stats for each group first, which are used for repness calculation
      const commentStatsWithComparatives: Array<[number, Record<string, any>]> =
        commentStatsWithTid.map(([tid, groupStats]) => {
          const processedGroupStats = {}

          Object.entries(groupStats).forEach(([groupId, stats]) => {
            const otherGroupStats = Object.entries(groupStats)
              .filter(([gid]) => gid !== groupId)
              .map(([_, stats]) => stats)
            processedGroupStats[groupId] = addComparativeStats(
              stats,
              otherGroupStats,
            )
          })

          return [tid, processedGroupStats]
        })

      // Pass commentTexts to selectRepComments
      const representativeComments = selectRepComments(
        commentStatsWithComparatives,
        commentTexts,
      )

      setRepComments(representativeComments)
    } catch (error) {
      console.error("Error calculating representative comments:", error)
    }
  }, [voteMatrix, commentTexts, groups, polisStats])

  // Format representative comments for display
  useEffect(() => {
    if (!repComments || !groups || !commentTexts || groups.length === 0) {
      setFormattedRepComments(null)
      return
    }

    // Process the data for each group
    const processedData = groups.map((group, groupIndex) => {
      const groupRepComments = repComments[groupIndex] || []

      // Format each comment with display-ready information
      const formattedComments = groupRepComments.map((comment) => {
        const commentText =
          commentTexts[comment.tid]?.text || `Comment ${comment.tid + 1}`
        const commentId =
          commentTexts[comment.tid]?.id || comment.tid.toString()
        const repType = comment.repful_for === "agree" ? "Agree" : "Disagree"
        const repnessScore = comment.repness.toFixed(2)
        const supportPercent = Math.round(
          (comment.n_success / comment.n_trials) * 100,
        )

        return {
          ...comment,
          commentText,
          commentId,
          repType,
          repnessScore,
          supportPercent,
        }
      })

      formattedComments.sort((a: CommentStats, b: CommentStats) => {
        return parseInt(b.repnessScore, 10) - parseInt(a.repnessScore, 10)
      })

      return {
        groupIndex,
        groupSize: group.points.length,
        comments: formattedComments,
      }
    })

    setFormattedRepComments(processedData)
  }, [repComments, groups, commentTexts]) // Dependencies ensure this runs when any of these change

  const handleReset = () => {
    setUsingImportedData(false)
    resetState()

    const newVoteMatrix = generateRandomVoteMatrix()
    setVoteMatrix(newVoteMatrix)
    debug("New vote matrix generated:", newVoteMatrix)
  }

  // Sorts for the comment table
  const handleSortChange = (sortField) => {
    // If clicking on a z-score column, use the currently selected group for sorting
    if (sortField === "overallZ") {
      if (sortBy === selectedZScoreGroup && sortType === "z-score") {
        // Toggle direction if already sorting by this field and type
        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
      } else {
        // Set new sort by the selected group with z-score type
        setSortBy(selectedZScoreGroup)
        setSortType("z-score")
        setSortDirection("desc")
      }
    } else if (sortField === "votes") {
      if (sortBy === selectedZScoreGroup && sortType === "vote-count") {
        // Toggle direction if already sorting by votes
        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
      } else {
        // Set new sort by votes for the selected group
        setSortBy(selectedZScoreGroup)
        setSortType("vote-count")
        setSortDirection("desc") // Default to showing most votes first
      }
    } else {
      // For other columns like ID, use original logic
      if (sortBy === sortField) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
      } else {
        setSortBy(sortField)
        setSortType("default")
        setSortDirection("desc")
      }
    }
  }

  // Add this function to handle dropdown changes
  const handleZScoreGroupChange = (e) => {
    const newGroup = e.target.value
    setSelectedZScoreGroup(newGroup)

    // If already sorting by the selected group, maintain the current sort type
    if (sortBy === "overall" || sortBy.startsWith("groupZ-")) {
      setSortBy(newGroup)
      // Keep the current sort direction and sort type
    }
  }

  // Add this function to handle sort type changes
  const handleSortTypeChange = (e) => {
    const newSortType = e.target.value
    setSortType(newSortType)

    // Apply the new sort type to the current group
    if (sortBy === "overall" || sortBy.startsWith("groupZ-")) {
      // Keep sorting by the same group but with new sort type
      // Keep the current sort direction
    }
  }

  // Function to get comment vote count for a specific group
  const getGroupVoteCount = (groupZScores, commentIndex, groupIndex) => {
    if (
      !groupZScores ||
      !groupZScores[commentIndex] ||
      !groupZScores[commentIndex][groupIndex]
    )
      return 0
    const groupData = groupZScores[commentIndex][groupIndex]
    // Total votes is agrees + disagrees (we don't count passes as votes for significance)
    return groupData.agrees + groupData.disagrees
  }

  // Function to get overall vote count
  const getOverallVoteCount = (comment) => {
    return comment.agrees + comment.disagrees
  }

  // Function to check if a comment is significant for the selected group
  const isSignificantForGroup = (
    zScoreData,
    groupZScores,
    commentIndex,
    selectedGroup,
  ) => {
    if (selectedGroup === "overall") {
      return (
        zScoreData &&
        (zScoreData.isAgreeSignificant || zScoreData.isDisagreeSignificant)
      )
    } else if (selectedGroup.startsWith("groupZ-")) {
      const groupIndex = parseInt(selectedGroup.split("-")[1])
      const groupData = groupZScores?.[commentIndex]?.[groupIndex]
      return (
        groupData &&
        (groupData.isAgreeSignificant || groupData.isDisagreeSignificant)
      )
    }
    return false
  }

  // Add this function to get the max absolute z-score for sorting
  const getMaxZScore = (zScoreData) => {
    if (!zScoreData) return 0
    return Math.max(
      zScoreData.agreementZScore || 0,
      zScoreData.disagreementZScore || 0,
      0,
    )
  }

  // Add this function to get max absolute z-score for a specific group
  const getGroupMaxZScore = (groupZScores, commentIndex, groupIndex) => {
    if (
      !groupZScores ||
      !groupZScores[commentIndex] ||
      !groupZScores[commentIndex][groupIndex]
    )
      return 0
    const groupData = groupZScores[commentIndex][groupIndex]
    return Math.max(
      groupData.agreementZScore || 0,
      groupData.disagreementZScore || 0,
      0,
    )
  }

  return (
    <div className="App">
      <h1>Polis Simulation</h1>
      <p style={{ maxWidth: "500px", margin: "0 auto 35px" }}>
        This page implements Polis collaborative polling algorithms in the
        browser, including PCA, k-means clustering, and consensus scoring.{" "}
        <strong>
          This implementation has not been audited, and should be considered an
          early research prototype.
        </strong>
      </p>

      {/* Tabs UI */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "import" ? "active" : ""}`}
            onClick={() => setActiveTab("import")}
          >
            Import Data
          </button>
          <button
            className={`tab ${activeTab === "random" ? "active" : ""}`}
            onClick={() => setActiveTab("random")}
          >
            Simulate Randomized Voters
          </button>
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {activeTab === "import" && (
            <div className="import-tab">
              <p>
                Enter the report to analyze
                <div style={{ fontSize: "80%", color: "#666", marginTop: 2 }}>
                  e.g.
                  https://pol.is/api/v3/reportExport/.../participant-votes.csv
                </div>
              </p>

              <input
                style={{ width: "400px" }}
                type="text"
                placeholder="Data Export URL (participant-votes.csv)"
                onChange={(e) => setDataUrl(e.target.value)}
                value={dataUrl}
              />
              {urlError && <div className="error-message">{urlError}</div>}
              <br />
              <button onClick={validateAndFetchData} disabled={!dataUrl}>
                Fetch Data
              </button>
            </div>
          )}

          {activeTab === "random" && (
            <div className="random-tab">
              <SimulationControls />
              <button
                onClick={() => {
                  handleReset()
                }}
              >
                Generate New Random Votes
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="data-source-indicator">
        {usingImportedData
          ? `Currently showing imported data from CSV file (${voteMatrix ? voteMatrix.length : 0} participants, ${commentTexts ? commentTexts.length : 0} comments)`
          : "Currently showing randomly generated data"}
      </div>

      {/* Participants table */}
      {usingImportedData &&
        participantsMetadata &&
        participantsMetadata.length > 0 && (
          <div className="participants-table-container">
            <h2>Participants</h2>
            <div className="table-container">
              <table className="participants-table">
                <thead>
                  <tr>
                    <th>Participant ID</th>
                    <th>Total Votes</th>
                    <th>Agrees</th>
                    <th>Disagrees</th>
                    <th>Group ID (CSV)</th>
                    <th>Group</th>
                  </tr>
                </thead>
                <tbody>
                  {participantsMetadata.map((participant, index) => (
                    <tr key={index}>
                      <td>{participant.participant}</td>
                      <td>{participant["n-votes"]}</td>
                      <td>{participant["n-agree"]}</td>
                      <td>{participant["n-disagree"]}</td>
                      <td>{participant["group-id"] || "N/A"}</td>
                      <td>
                        {groups && groups.length > 0
                          ? groups.findIndex((g) => g.points.includes(index)) +
                              1 || "N/A"
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Comments table */}
      {usingImportedData && commentTexts && commentTexts.length > 0 && (
        <div className="comments-table-container">
          <h2>Comments</h2>
          <div className="table-controls">
            <div className="group-selector">
              <label htmlFor="zScoreGroup">Show Data For: </label>
              <select
                id="zScoreGroup"
                value={selectedZScoreGroup}
                onChange={handleZScoreGroupChange}
              >
                <option value="overall">Overall</option>
                {groups &&
                  groups.map((_, groupIndex) => (
                    <option key={groupIndex} value={`groupZ-${groupIndex}`}>
                      Group {groupIndex + 1}
                    </option>
                  ))}
              </select>
            </div>

            <div className="sort-type-selector">
              <label htmlFor="sortType">Sort By: </label>
              <select
                id="sortType"
                value={sortType}
                onChange={handleSortTypeChange}
              >
                <option value="z-score">Z-Score</option>
                <option value="vote-count">Vote Count</option>
              </select>

              <button
                className={`sort-direction-toggle ${sortDirection === "desc" ? "active" : ""}`}
                onClick={() =>
                  setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                }
                title={
                  sortDirection === "desc"
                    ? "Sort descending"
                    : "Sort ascending"
                }
              >
                {sortDirection === "desc"
                  ? "↓ Highest First"
                  : "↑ Lowest First"}
              </button>
            </div>
          </div>

          <div className="comments-table-scroll">
            <table className="comments-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSortChange("id")}
                    className="sortable-header"
                  >
                    ID{" "}
                    {sortBy === "id" && (sortDirection === "asc" ? "▲" : "▼")}
                  </th>
                  <th>Comment Text</th>
                  <th>Agrees</th>
                  <th>Disagrees</th>
                  <th>Passes</th>
                  <th
                    onClick={() => handleSortChange("overallZ")}
                    className="sortable-header"
                  >
                    Z-Scores (Agree, Disagree)
                    {sortBy !== "id" &&
                      sortType === "z-score" &&
                      (sortDirection === "asc" ? " ▲" : " ▼")}
                  </th>
                  <th
                    onClick={() => handleSortChange("votes")}
                    className="sortable-header"
                  >
                    Votes
                    {sortBy !== "id" &&
                      sortType === "vote-count" &&
                      (sortDirection === "asc" ? " ▲" : " ▼")}
                  </th>
                  <th>Author</th>
                </tr>
              </thead>
              <tbody>
                {commentTexts
                  .map((comment, index) => {
                    // Add sorting metadata to each comment
                    const zScoreData = polisStats?.zScores?.[index]
                    const maxOverallZScore = getMaxZScore(zScoreData)
                    const overallVoteCount = getOverallVoteCount(comment)

                    return {
                      comment,
                      index,
                      maxOverallZScore,
                      overallVoteCount,
                      // Add ability to sort by any group's z-score
                      groupZScores:
                        groups?.map((_, groupIndex) =>
                          getGroupMaxZScore(groupZScores, index, groupIndex),
                        ) || [],
                      // Add ability to sort by vote count for each group
                      groupVoteCounts:
                        groups?.map((_, groupIndex) =>
                          getGroupVoteCount(groupZScores, index, groupIndex),
                        ) || [],
                      // Check if this comment is significant for the selected group
                      isSignificant: isSignificantForGroup(
                        zScoreData,
                        groupZScores,
                        index,
                        selectedZScoreGroup,
                      ),
                    }
                  })
                  // Filter to only show significant comments if sorting by vote count
                  .filter((item) => {
                    if (sortType !== "vote-count") return true
                    return item.isSignificant
                  })
                  .sort((a, b) => {
                    // Sort based on the selected field, group, and type
                    if (sortBy === "id") {
                      // Sort by comment ID
                      const idA = parseInt(a.comment.id) || 0
                      const idB = parseInt(b.comment.id) || 0
                      return sortDirection === "asc" ? idA - idB : idB - idA
                    } else if (sortBy === "overall") {
                      if (sortType === "z-score") {
                        // Sort by overall z-score
                        return sortDirection === "asc"
                          ? a.maxOverallZScore - b.maxOverallZScore
                          : b.maxOverallZScore - a.maxOverallZScore
                      } else {
                        // vote-count
                        // Sort by overall vote count
                        return sortDirection === "asc"
                          ? a.overallVoteCount - b.overallVoteCount
                          : b.overallVoteCount - a.overallVoteCount
                      }
                    } else if (sortBy.startsWith("groupZ-")) {
                      const groupIndex = parseInt(sortBy.split("-")[1])

                      if (sortType === "z-score") {
                        // Sort by specific group z-score
                        const aScore = a.groupZScores[groupIndex] || 0
                        const bScore = b.groupZScores[groupIndex] || 0
                        return sortDirection === "asc"
                          ? aScore - bScore
                          : bScore - aScore
                      } else {
                        // vote-count
                        // Sort by specific group vote count
                        const aVotes = a.groupVoteCounts[groupIndex] || 0
                        const bVotes = b.groupVoteCounts[groupIndex] || 0
                        return sortDirection === "asc"
                          ? aVotes - bVotes
                          : bVotes - aVotes
                      }
                    }
                    return 0
                  })
                  .map(({ comment, index, isSignificant }) => {
                    // Original render code with modifications
                    const zScoreData = polisStats?.zScores?.[index]

                    return (
                      <React.Fragment key={index}>
                        <tr
                          onClick={() => highlightComment(index)}
                          className={`${highlightedComment === index ? "highlighted-comment" : ""}
                          ${sortType === "vote-count" && !isSignificant ? "non-significant-comment" : ""}
                          ${comment.moderated === "-1" ? "moderated-comment" : ""}`}
                        >
                          <td>{comment.id}</td>
                          <td>
                            {comment.text}
                            {comment.moderated === "-1" && (
                              <span className="moderation-flag">
                                {" "}
                                [moderated]
                              </span>
                            )}
                          </td>
                          <td className="vote-cell">
                            <div className="vote-count">{comment.agrees}</div>
                            {(comment.agrees ||
                              comment.disagrees ||
                              comment.passes) > 0 && (
                              <div className="vote-percent">
                                {Math.round(
                                  (comment.agrees /
                                    (comment.agrees +
                                      comment.disagrees +
                                      (comment.passes || 0))) *
                                    100,
                                )}
                                %
                              </div>
                            )}
                          </td>
                          <td className="vote-cell">
                            <div className="vote-count">
                              {comment.disagrees}
                            </div>
                            {(comment.agrees ||
                              comment.disagrees ||
                              comment.passes) > 0 && (
                              <div className="vote-percent">
                                {Math.round(
                                  (comment.disagrees /
                                    (comment.agrees +
                                      comment.disagrees +
                                      (comment.passes || 0))) *
                                    100,
                                )}
                                %
                              </div>
                            )}
                          </td>
                          <td className="vote-cell">
                            <div className="vote-count">
                              {comment.passes || 0}
                            </div>
                            {(comment.agrees ||
                              comment.disagrees ||
                              comment.passes) > 0 && (
                              <div className="vote-percent">
                                {Math.round(
                                  ((comment.passes || 0) /
                                    (comment.agrees +
                                      comment.disagrees +
                                      (comment.passes || 0))) *
                                    100,
                                )}
                                %
                              </div>
                            )}
                          </td>

                          <td className="group-z-scores-cell">
                            {/* Overall Z-Scores - highlight if it's the selected group and reduce opacity for others */}
                            {zScoreData && (
                              <div
                                className={`group-z-score-item ${zScoreData.isAgreeSignificant ? "significant-agree" : ""} ${zScoreData.isDisagreeSignificant ? "significant-disagree" : ""} ${selectedZScoreGroup === "overall" ? "selected-group" : "non-selected-group"}`}
                              >
                                <strong
                                  className={
                                    selectedZScoreGroup === "overall"
                                      ? "current-sort-group"
                                      : ""
                                  }
                                >
                                  Overall:
                                </strong>{" "}
                                {zScoreData.agreementZScore.toFixed(2)},{" "}
                                {zScoreData.disagreementZScore.toFixed(2)}
                              </div>
                            )}

                            {/* Group-specific Z-Scores - highlight the selected group and reduce opacity for others */}
                            {groupZScores &&
                              groups &&
                              groups.length > 0 &&
                              groups.map((group, groupIndex) => {
                                const groupData =
                                  groupZScores[index]?.[groupIndex]

                                if (!groupData) return null

                                // Add classes to highlight significant z-scores
                                const agreeClassName =
                                  groupData.isAgreeSignificant
                                    ? "significant-agree"
                                    : ""
                                const disagreeClassName =
                                  groupData.isDisagreeSignificant
                                    ? "significant-disagree"
                                    : ""
                                const isSelectedGroup =
                                  selectedZScoreGroup === `groupZ-${groupIndex}`
                                    ? "selected-group"
                                    : "non-selected-group"
                                const className =
                                  `group-z-score-item ${agreeClassName} ${disagreeClassName} ${isSelectedGroup}`.trim()

                                return (
                                  <div key={groupIndex} className={className}>
                                    <strong
                                      className={
                                        selectedZScoreGroup ===
                                        `groupZ-${groupIndex}`
                                          ? "current-sort-group"
                                          : ""
                                      }
                                    >
                                      Group {groupIndex + 1}:
                                    </strong>{" "}
                                    {groupData.agreementZScore.toFixed(2)},{" "}
                                    {groupData.disagreementZScore.toFixed(2)}
                                  </div>
                                )
                              })}
                          </td>

                          {/* Add vote count column that shows the vote count for the selected group */}
                          <td className="vote-count-cell">
                            {selectedZScoreGroup === "overall" ? (
                              <div className="selected-group">
                                {comment.agrees + comment.disagrees}
                              </div>
                            ) : (
                              groupZScores &&
                              (() => {
                                const groupIndex = parseInt(
                                  selectedZScoreGroup.split("-")[1],
                                )
                                const groupData =
                                  groupZScores[index]?.[groupIndex]
                                if (!groupData) return <div>0</div>

                                return (
                                  <div className="selected-group">
                                    {groupData.agrees + groupData.disagrees}
                                  </div>
                                )
                              })()
                            )}
                          </td>

                          <td>{comment.author_id}</td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            {polisStats &&
              "Statistically significant at 90% confidence (z-score > 1.2816)"}
            <div>
              <strong>Sorting:</strong>{" "}
              {sortType === "z-score" ? "Z-Scores" : "Vote Counts"} for
              {selectedZScoreGroup === "overall"
                ? " Overall"
                : ` Group ${parseInt(selectedZScoreGroup.split("-")[1]) + 1}`}
              {sortDirection === "asc" ? " (ascending)" : " (descending)"}
              {sortType === "vote-count" &&
                " - showing only statistically significant comments"}
            </div>
          </div>
        </div>
      )}

      <VoteMatrix
        voteMatrix={voteMatrix}
        handleVoteChange={handleVoteChange}
        selectedGroup={selectedGroup}
        groups={groups}
        highlightedComment={highlightedComment}
        commentTexts={commentTexts}
      />
      <div className="side-by-side-container">
        <PCAProjection
          pcaProjection={pcaProjection}
          groups={groups}
          selectedGroup={selectedGroup}
        />
        <GroupAnalysis
          groups={groups}
          setSelectedGroup={setSelectedGroup}
          selectedGroup={selectedGroup}
        />
      </div>

      {/* Top comments overall - Combined and sorted by max absolute z-score */}
      <div className="top-overall">
        <h2>Overall Statistical Consensus</h2>

        {polisStats ? (
          <div className="stats-consensus-section">
            {polisStats.consensusComments.agree.length > 0 ||
            polisStats.consensusComments.disagree.length > 0 ? (
              <div className="consensus-chart-container">
                <ConsensusBarChart
                  groups={groups}
                  comments={[
                    ...polisStats.consensusComments.agree.map((comment) => ({
                      ...comment,
                      type: "agree",
                    })),
                    ...polisStats.consensusComments.disagree.map((comment) => ({
                      ...comment,
                      type: "disagree",
                    })),
                  ]}
                  commentTexts={commentTexts}
                  voteMatrix={voteMatrix}
                  sortByZScore={true}
                />
              </div>
            ) : (
              <div>No statistically significant comments found</div>
            )}
          </div>
        ) : (
          <div className="consensus-chart-container">
            <ConsensusBarChart
              groups={groups}
              comments={topConsensusComments}
              commentTexts={commentTexts}
              voteMatrix={voteMatrix}
            />
          </div>
        )}
      </div>

      <div className="top-by-groups">
        <h2>Group Representative Comments</h2>
        <p>
          Showing representative comments for each group based on statistical
          analysis.
        </p>

        {groups.length === 0 ? (
          <div>No groups identified yet</div>
        ) : (
          <div>
            {groups.map((group, groupIndex) => {
              // Get the representative comments for this group
              const groupRepComments =
                repComments && repComments[groupIndex]
                  ? repComments[groupIndex]
                  : []

              // Sort comments by repness score (highest first)
              const sortedComments = [...groupRepComments].sort(
                (a, b) =>
                  b.repness * b.repness_test - a.repness * a.repness_test,
              )

              // Format comments for the ConsensusBarChart component
              const formattedComments = sortedComments.map((comment) => ({
                commentIndex: comment.tid,
                text:
                  commentTexts?.[comment.tid]?.text ||
                  `Comment ${comment.tid + 1}`,
                numAgrees: Object.values(
                  groupZScores[comment.tid] || {},
                ).reduce((sum, group) => sum + (group.agrees || 0), 0),
                numDisagrees: Object.values(
                  groupZScores[comment.tid] || {},
                ).reduce((sum, group) => sum + (group.disagrees || 0), 0),
                numSeen: comment.n_trials,
                agreementZScore: comment.p_test,
                repnessScore: comment.repness * comment.repness_test,
                repful_for: comment.repful_for,
              }))

              // Render group consensus table with repness-sorted comments
              return (
                <div key={groupIndex} className="group-consensus-section">
                  <h3 className="group-heading">
                    Group {groupIndex + 1} ({group.points.length} participants)
                  </h3>

                  {formattedComments.length === 0 ? (
                    <div>No representative comments found for this group</div>
                  ) : (
                    <div className="consensus-chart-container">
                      <ConsensusBarChart
                        groups={groups}
                        comments={formattedComments}
                        commentTexts={commentTexts}
                        voteMatrix={voteMatrix}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Group Representative Comments Table - only render when data is available */}
      {formattedRepComments && (
        <div className="rep-comments-table-container">
          <h2>Group Representative Comments, Detail</h2>
          <p>
            Comments that statistically represent each group's viewpoint
            compared to other groups.
          </p>

          <div className="rep-comments-tables">
            {formattedRepComments.map(({ groupIndex, groupSize, comments }) => (
              <div key={groupIndex} className="rep-comments-group">
                <h3>
                  Group {groupIndex + 1} ({groupSize} participants)
                </h3>

                {comments.length === 0 ? (
                  <p>No representative comments identified for this group</p>
                ) : (
                  <div className="rep-comments-table-scroll">
                    <table className="rep-comments-table">
                      <thead>
                        <tr>
                          <th>Comment</th>
                          <th>Type</th>
                          <th>Stats</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comments.map((comment, index) => (
                          <tr
                            key={index}
                            onClick={() => highlightComment(comment.tid)}
                            className={
                              highlightedComment === comment.tid
                                ? "highlighted-comment"
                                : ""
                            }
                          >
                            <td className="rep-comment-text">
                              <span className="comment-id">
                                {comment.commentId}:
                              </span>{" "}
                              {comment.commentText}
                            </td>
                            <td className={`rep-type ${comment.repful_for}`}>
                              {comment.repType}
                            </td>
                            <td className="rep-stats">
                              <div>
                                Repness: <strong>{comment.repnessScore}</strong>
                              </div>
                              <div>
                                Z-score:{" "}
                                <strong>{comment.p_test.toFixed(2)}</strong>
                              </div>
                              <div>
                                {comment.repful_for === "agree" ? (
                                  <span>
                                    {comment.supportPercent}% agree (
                                    {comment.n_success} of {comment.n_trials})
                                  </span>
                                ) : (
                                  <span>
                                    {comment.supportPercent}% disagree (
                                    {comment.n_success} of {comment.n_trials})
                                  </span>
                                )}
                              </div>
                              <div className="additional-metrics">
                                <span className="metric-label">
                                  p_test (proportion):
                                </span>{" "}
                                <strong>{comment.p_test.toFixed(2)}</strong>
                              </div>
                              <div className="additional-metrics">
                                <span className="metric-label">
                                  repness_test (diff):
                                </span>{" "}
                                <strong>
                                  {comment.repness_test.toFixed(2)}
                                </strong>
                              </div>
                              <div className="additional-metrics">
                                <span className="metric-label">p_success:</span>{" "}
                                <strong>
                                  {(comment.p_success * 100).toFixed(0)}%
                                </strong>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="footer">
        <p>
          <a
            href="https://github.com/raykyri/osccai-simulation"
            target="_blank"
            rel="noreferrer noopener"
          >
            Github
          </a>
        </p>
        <p>
          MIT &copy; {new Date().getFullYear()}. Based on{" "}
          <a
            href="https://github.com/collect-intel/osccai-simulation"
            target="_blank"
            rel="noreferrer noopener"
          >
            OSCCAI
          </a>
          .
        </p>
      </div>
    </div>
  )
}

const App = () => {
  return (
    <SimulationProvider>
      <SimulationContent />
    </SimulationProvider>
  )
}

export function selectRepComments(
    commentStatsWithTid: [number, Record<string, any>][],
    commentTexts?: any[],
  ): Record<string, FinalizedCommentStats[]> {
    // Initialize result structure with empty arrays for each group ID
    const result: Record<
      string,
      {
        best: FinalizedCommentStats | null
        best_agree: any | null
        sufficient: FinalizedCommentStats[]
      }
    > = {}
  
    // Get all group IDs from the first comment's data
    if (commentStatsWithTid.length === 0) return {}
  
    const groupIds = Object.keys(commentStatsWithTid[0][1])
  
    // Initialize result structure
    groupIds.forEach((gid) => {
      result[gid] = { best: null, best_agree: null, sufficient: [] }
    })
  
    // Process each comment
    commentStatsWithTid.forEach(([tid, groupsData]) => {
      if (commentTexts?.[tid]?.moderated === "-1") {
        return
      }
  
      Object.entries(groupsData).forEach(([gid, commentStats]) => {
        const groupResult = result[gid]
  
        // Check if comment passes significance test
        if (passesByTest(commentStats)) {
          const finalizedStats = finalizeCommentStats(tid, commentStats)
          groupResult.sufficient.push(finalizedStats)
        }
  
        // Track the best comment
        if (
          beatsBestByTest(commentStats, groupResult.best?.repness_test || null)
        ) {
          groupResult.best = finalizeCommentStats(tid, commentStats)
        }
  
        // Track the best agreement comment
        if (beatsBestAgr(commentStats, groupResult.best_agree)) {
          groupResult.best_agree = { ...commentStats, tid }
        }
      })
    })
  
    const finalResult: Record<string, FinalizedCommentStats[]> = {}
  
    Object.entries(result).forEach(([gid, { best, best_agree, sufficient }]) => {
      // If no sufficient comments, use the best
      if (sufficient.length === 0) {
        finalResult[gid] = best ? [best] : []
      } else {
        // Finalize the best_agree comment if we have one
        let bestAgreeComment: FinalizedCommentStats | null = null
        if (best_agree) {
          bestAgreeComment = finalizeCommentStats(best_agree.tid, best_agree)
          bestAgreeComment.best_agree = true
        }
  
        // Start with best agree if we have it
        let selectedComments: FinalizedCommentStats[] = []
        if (bestAgreeComment) {
          selectedComments.push(bestAgreeComment)
          // Remove it from sufficient if it's there
          sufficient = sufficient.filter((c) => c.tid !== bestAgreeComment!.tid)
        }
  
        // Add sorted sufficient comments
        const sortedSufficient = sufficient.sort(
          (a, b) => repnessMetric(b) - repnessMetric(a),
        )
  
        // Add up to 5 comments total, including best_agree
        selectedComments = [...selectedComments, ...sortedSufficient].slice(0, 20)
  
        // Sort with agrees before disagrees
        finalResult[gid] = agreesBeforeDisagrees(selectedComments)
      }
    })
  
    return finalResult
  }

  // Test if a proportion differs from 0.5
export function propTest(succ: number, n: number): number {
    const adjustedSucc = succ + 1
    const adjustedN = n + 1
    return 2 * Math.sqrt(adjustedN) * (adjustedSucc / adjustedN - 0.5)
  }

  // Helper function to check if z-score is significant at 90% confidence
export function zSig90(zVal: number): boolean {
    return zVal > 1.2816
  }

  // Helper function to calculate comparative statistics for groups
export function addComparativeStats(inStats: any, restStats: any[]): any {
    // Sum up values across other groups
    const sumOtherNa = restStats.reduce((sum, g) => sum + g.na, 0)
    const sumOtherNd = restStats.reduce((sum, g) => sum + g.nd, 0)
    const sumOtherNs = restStats.reduce((sum, g) => sum + g.ns, 0)
  
    // Calculate relative agreement and disagreement
    const ra = inStats.pa / ((1 + sumOtherNa) / (2 + sumOtherNs))
    const rd = inStats.pd / ((1 + sumOtherNd) / (2 + sumOtherNs))
  
    // Calculate z-scores for the differences between proportions
    const rat = twoPropTest(inStats.na, sumOtherNa, inStats.ns, sumOtherNs)
    const rdt = twoPropTest(inStats.nd, sumOtherNd, inStats.ns, sumOtherNs)
  
    return {
      ...inStats,
      ra,
      rd,
      rat,
      rdt,
    }
  }

  // Finalize comment stats for client consumption
function finalizeCommentStats(tid: number, stats: any): FinalizedCommentStats {
    const { na, nd, ns, pa, pd, pat, pdt, ra, rd, rat, rdt } = stats
  
    // Need to add a minimum threshold, e.g., at least 3 votes in that direction
    const MIN_VOTES = 3
    const isAgreeMoreRep = (rat > rdt && na >= MIN_VOTES) || nd < MIN_VOTES
    const repful_for = isAgreeMoreRep ? "agree" : "disagree"
  
    return {
      tid,
      n_success: isAgreeMoreRep ? na : nd,
      n_trials: ns,
      p_success: isAgreeMoreRep ? pa : pd,
      p_test: isAgreeMoreRep ? pat : pdt,
      repness: isAgreeMoreRep ? ra : rd,
      repness_test: isAgreeMoreRep ? rat : rdt,
      repful_for,
    }
  }
  
  // Calculate repness metric for sorting
  function repnessMetric(data: FinalizedCommentStats): number {
    return data.repness * data.repness_test * data.p_success * data.p_test
  }
  
  // Order comments with agrees before disagrees
  function agreesBeforeDisagrees(
    comments: FinalizedCommentStats[],
  ): FinalizedCommentStats[] {
    const agrees = comments.filter((c) => c.repful_for === "agree")
    const disagrees = comments.filter((c) => c.repful_for === "disagree")
    return [...agrees, ...disagrees]
  }

  // Test if two proportions differ significantly
function twoPropTest(
    succIn: number,
    succOut: number,
    popIn: number,
    popOut: number,
  ): number {
    const adjustedSuccIn = succIn + 1
    const adjustedSuccOut = succOut + 1
    const adjustedPopIn = popIn + 1
    const adjustedPopOut = popOut + 1
  
    const pi1 = adjustedSuccIn / adjustedPopIn
    const pi2 = adjustedSuccOut / adjustedPopOut
    const piHat =
      (adjustedSuccIn + adjustedSuccOut) / (adjustedPopIn + adjustedPopOut)
  
    if (piHat === 1) return 0
  
    return (
      (pi1 - pi2) /
      Math.sqrt(piHat * (1 - piHat) * (1 / adjustedPopIn + 1 / adjustedPopOut))
    )
  }
  
  // Check if comment stats pass significance tests
  function passesByTest(commentStats: any): boolean {
    return (
      (zSig90(commentStats.rat) && zSig90(commentStats.pat)) ||
      (zSig90(commentStats.rdt) && zSig90(commentStats.pdt))
    )
  }
  
  // Check if comment beats the current best by test value
  function beatsBestByTest(
    commentStats: any,
    currentBestZ: number | null,
  ): boolean {
    return (
      currentBestZ === null ||
      Math.max(commentStats.rat, commentStats.rdt) > currentBestZ
    )
  }
  
  // Check if comment is a better representative of agreement
  function beatsBestAgr(commentStats: any, currentBest: any): boolean {
    const { na, nd, ra, rat, pa, pat, ns } = commentStats
    // Don't accept comments with no votes
    if (na === 0 && nd === 0) return false
  
    // If we have a current best with good repness
    if (currentBest && currentBest.ra > 1.0) {
      return (
        ra * rat * pa * pat >
        currentBest.ra * currentBest.rat * currentBest.pa * currentBest.pat
      )
    }
  
    // If we have a current best but only by probability
    if (currentBest) {
      return pa * pat > currentBest.pa * currentBest.pat
    }
  
    // Otherwise accept if either metric looks good
    return zSig90(pat) || (ra > 1.0 && pa > 0.5)
  }