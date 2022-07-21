/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/currency', 'N/currentRecord', 'N/email', 'N/encode', 'N/error', 'N/file', 'N/format', 'N/record', 'N/redirect', 'N/render', 'N/runtime', 'N/search', 'N/task', 'N/format/i18n'],
	/**
	 * @param {currency} currency
	 * @param {currentRecord} currentRecord
	 * @param {email} email
	 * @param {encode} encode
	 * @param {error} error
	 * @param {file} file
	 * @param {format} format
	 * @param {record} record
	 * @param {redirect} redirect
	 * @param {render} render
	 * @param {runtime} runtime
	 * @param {search} search
	 * @param {task} task
	 * @param {formati} formati
	 */
	function (currency, currentRecord, email, encode, error, file, format, record, redirect, render, runtime, search, task, formati) {

		/**
		 * Marks the beginning of the Map/Reduce process and generates input data.
		 *
		 * @typedef {Object} ObjectRef
		 * @property {number} id - Internal ID of the record instance
		 * @property {string} type - Record type id
		 *
		 * @return {Array|Object|Search|RecordRef} inputSummary
		 * @since 2015.1
		 */

		function getSubsidiaryTimezone(officeID) {

			var subsidiarySearch = search.create({
				type: 'subsidiary',
				columns: [
					'name',
					'namenohierarchy',
					'name',
					'custrecord_lc_subsidiary_time_zone'
				],
				filters: [
					['internalid', 'is', officeID]
				]
			});

			var subsidiaryResults = subsidiarySearch.run().getRange({
				start: 0,
				end: 10
			});
			return (subsidiaryResults[0].getValue({ name: 'custrecord_lc_subsidiary_time_zone' }));

		}

		function deconvertNumber(inputNumString) {
			if (inputNumString.indexOf('(') != -1) {
				//negative situation
				inputNumString = inputNumString.replace(/[\[\](]+/g, '');
				inputNumString = inputNumString.replace(/[\[\])]+/g, '');
				inputNumString = inputNumString.replace(/[\[\],]+/g, '');
				return +inputNumString * -1;
			} else {
				inputNumString = inputNumString.replace(/[\[\],]+/g, '');
				return +inputNumString;
			}
		}
		function compareTranDate(a, b) {
			if (a.sorttrandate < b.sorttrandate) {
				return -1;
			}
			if (a.sorttrandate > b.sorttrandate) {
				return 1;
			}
			return 0;
		}

		function formatDateAustralia(date) {
			if (date !== undefined && date !== "") {
				var myDate = new Date(date);
				var month = [
					"January",
					"February",
					"March",
					"April",
					"May",
					"June",
					"July",
					"August",
					"September",
					"October",
					"November",
					"December",
				][myDate.getMonth()];
				var str = month + " " + myDate.getFullYear();
				return str;
			}
			return "";
		}

		function numberWithCommas(x) {
			return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}

		function convertMyCurrency(myNumber, sourceCurr, targetCurr, exchangeRate) {
			if (((exchangeRate) && (exchangeRate != "")) && (sourceCurr != targetCurr)) {

				var convertedAmount = +myNumber * +exchangeRate;

				return convertedAmount;
			} else {
				return myNumber;
			}
		}

		function getIndexLength(post1, post2) {
			var mili1 = new Date(Date.parse('01 ' + post1));
			var mili2 = new Date(Date.parse('01 ' + post2));
			var diff = monthDiff(mili1, mili2) + 1;
			return diff;
		}

		function monthDiff(d1, d2) {
			var months;
			months = (d2.getFullYear() - d1.getFullYear()) * 12;
			months -= d1.getMonth();
			months += d2.getMonth();
			return months <= 0 ? 0 : months;
		}
		function formatMonthDate(date) {
			if (date !== undefined && date !== "") {
				var myDate = new Date(date);
				var month = [
					"Jan",
					"Feb",
					"Mar",
					"Apr",
					"May",
					"Jun",
					"Jul",
					"Aug",
					"Sep",
					"Oct",
					"Nov",
					"Dec",
				][myDate.getMonth()];
				var str = month + " " + myDate.getFullYear();
				return str;
			}
			return "";
		}

		function formatMonthDateTitle(date) {
			if (date !== undefined && date !== "") {
				var myDate = new Date(date);
				var month = [
					"Jan",
					"Feb",
					"Mar",
					"Apr",
					"May",
					"Jun",
					"Jul",
					"Aug",
					"Sep",
					"Oct",
					"Nov",
					"Dec",
				][myDate.getMonth()];
				var str = month + "-" + myDate.getFullYear();
				return str;
			}
			return "";
		}

		function getYearToDateMonth(postingPer) {
			var postingPerList = postingPer.split(' ');
			var year = postingPerList[postingPerList.length - 1];
			if ((postingPer.indexOf('Oct') == -1) && (postingPer.indexOf('Nov') == -1) && (postingPer.indexOf('Dec') == -1)) {
				var returnyear = +year - 1;
			} else {
				var returnyear = +year;
			}
			return ('Oct ' + returnyear.toString());
		}

		function getEndOfFinYear(postingPer) {
			var postingPerList = postingPer.split(' ');
			var year = postingPerList[postingPerList.length - 1];
			if ((postingPer.indexOf('Oct') != -1) || (postingPer.indexOf('Nov') != -1) || (postingPer.indexOf('Dec') != -1)) {
				var returnyear = +year + 1;
			} else {
				var returnyear = +year;
			}
			return ('Sep ' + returnyear.toString());
		}

		function getTrailing12Month(postingPer) {
			var base = new Date(Date.parse('01 ' + postingPer));
			base.setMonth(base.getMonth() - 11);
			return formatMonthDate(base);
		}

		function massSendEmail(workerproj, trackerID, subsidiary, type, fileID, triggerEmail, postingPer, uniqueTime) {
			if (triggerEmail == 'T') {
				var monthFormat = postingPer.replace(" ", "-");
				var fileObj = file.load({
					id: fileID
				});
				var emailTemplate = record.load({
					type: 'emailtemplate',
					id: 2
				});
				var emailBody = emailTemplate.getValue({
					fieldId: 'content'
				});
				var monthYYYY = formatMonthDateTitle(new Date());
				if (type == 'worker') {
					var typeHeader = 'Worker';
				} else {
					var typeHeader = 'Project';
				}
				var subsidSearch = search.create({
					type: 'subsidiary',
					columns: [
						'name',
						'internalid',
						'namenohierarchy'
					],
					filters: [
						['internalid', 'is', subsidiary]
					]
				});

				var subsidResults = subsidSearch.run().getRange({
					start: 0,
					end: 10
				});
				var subsidEmailTitle = subsidResults[0].getValue({ name: 'namenohierarchy' });
				if (type == 'worker') {
					var workMappingSearch = search.create({
						type: 'customrecord_lc_worker_recipient',
						columns: [
							'name',
							'custrecord_lc_worker',
							'custrecord_lc_employee_worker',
							'custrecord_lc_home_office',
							'custrecord_lc_field_office'
						],
						filters: [
							[['custrecord_lc_home_office', 'is', subsidiary],
								'or', ['custrecord_lc_field_office', 'is', subsidiary]
							],
							'and', ['isinactive', 'is', false],
							'and', ['custrecord_lc_worker', 'is', workerproj]
						]
					});

					var workMappingResults = workMappingSearch.run().getRange({
						start: 0,
						end: 1000
					});
					// log.debug('worker mapping result', workMappingResults);
					for (var m = 0; m < workMappingResults.length; m++) {
						var recipientSend = workMappingResults[m].getValue({ name: 'custrecord_lc_employee_worker' });
						var mappingName = workMappingResults[m].getValue({ name: 'name' });
						// log.debug('email to send to', recipientSend);
						email.send({
							author: recipientSend,
							recipients: recipientSend,
							subject: monthFormat + ' ' + typeHeader + ' ' + 'Account Statement -' + subsidEmailTitle.replace('SIM', '').replace('Ltd', '') + ': ' + mappingName,
							body: emailBody,
							attachments: [fileObj]
						});
					}

				} else {
					var projMappingSearch = search.create({
						type: 'customrecord_lc_proj_statement_recipient',
						columns: [
							'name',
							'custrecord_lc_project',
							'custrecord_lc_employee',
							'custrecord_lc_subsidiary'
						],
						filters: [
							['custrecord_lc_subsidiary', 'is', subsidiary],
							'and', ['isinactive', 'is', false],
							'and', ['custrecord_lc_project', 'is', workerproj]
						]
					});

					var projMappingResults = projMappingSearch.run().getRange({
						start: 0,
						end: 1000
					});
					for (var m = 0; m < projMappingResults.length; m++) {
						var recipientSend = projMappingResults[m].getValue({ name: 'custrecord_lc_employee' });
						var mappingName = projMappingResults[m].getValue({ name: 'name' });
						email.send({
							author: recipientSend,
							recipients: recipientSend,
							subject: monthFormat + ' ' + typeHeader + ' ' + 'Account Statement -' + subsidEmailTitle.replace('SIM', '').replace('Ltd', '') + ': ' + mappingName,
							body: emailBody,
							attachments: [fileObj]
						});
					}
				}
			}
		}

		function getListOfAllWorkerProjForOffice(officeID, type) {
			returnList = [];
			if (type == 'worker') {
				var workMappingSearch = search.create({
					type: 'customrecord_lc_worker_recipient',
					columns: [
						'name',
						'custrecord_lc_worker',
						'custrecord_lc_employee_worker',
						'custrecord_lc_home_office',
						'custrecord_lc_field_office'
					],
					filters: [
						[['custrecord_lc_home_office', 'is', officeID],
							'or', ['custrecord_lc_field_office', 'is', officeID]],
						'and', ['isinactive', 'is', false]
					]
				});
				var mappingList = getAllResults(workMappingSearch, returnList);

			} else {
				var projMappingSearch = search.create({
					type: 'customrecord_lc_proj_statement_recipient',
					columns: [
						'name',
						'custrecord_lc_project',
						'custrecord_lc_employee',
						'custrecord_lc_subsidiary'
					],
					filters: [
						['custrecord_lc_subsidiary', 'is', officeID],
						'and', ['isinactive', 'is', false]
					]
				});

				var mappingList = getAllResults(projMappingSearch, returnList);
			}
			return mappingList;
		}

		function individualSummaryEmail(trackerID, triggerEmail, subsidID, subfolderID, inputWorkerProjList, uniqueTime, reportType, userid) {
			log.debug('user printer id', userid);
			var fileListSearch = search.create({
				type: 'file',
				columns: [{ name: 'name' },
				{ name: 'internalid' }]
			});
			fileListSearch.filters = [search.createFilter({
				name: 'folder',
				operator: search.Operator.IS,
				values: subfolderID
			})];
			var fileListResults = fileListSearch.run().getRange({
				start: 0,
				end: 1000
			});
			var emailBody = 'Statement run has been completed for the following. Please see results below:\n\n'
			//		var totalCount = childList.length;
			var totalCount = 0;
			var successCount = 0;
			var failCount = 0;
			if (reportType == 'worker') {
				// log.debug('subsid id to pass for email match', subsidID);
				var workerList = getListOfAllWorkerProjForOffice(subsidID, 'worker');
				// log.debug('worker mapping list return', workerList);
				for (var m = 0; m < inputWorkerProjList.length; m++) {
					for (var l = 0; l < workerList.length; l++) {
						//			log.debug('worker mapping list to loop', workerList[l]);
						var workerID = workerList[l].getText({ name: 'custrecord_lc_worker' });
						var workerMapping = workerList[l].getValue({ name: 'name' });
						var workerNumber = workerList[l].getValue({ name: 'custrecord_lc_worker' });
						var workProjList = workerID.split(' ');
						var nameToPrint = workProjList[0];
						if (workerNumber == inputWorkerProjList[m]) {
							var fileFound = false;
							//	        	var existInInput = false;
							//	        	log.debug('worker id from input list', workerID);
							//	        	log.debug('worker id from tracker', workprojName);
							for (var k = 0; k < fileListResults.length; k++) {

								var fullName = fileListResults[k].getValue({ name: 'name' });
								var fileFullNameSplit = fullName.split('-');
								//	        		log.debug('file full name in email', fileFullNameSplit);
								//	        		log.debug('name comparison', fileFullNameSplit[0]);
								//	        		log.debug('name to print', nameToPrint);
								//	        		log.debug('comparison result', ((fileFullNameSplit[0]).indexOf(nameToPrint) != -1));
								if ((fileFullNameSplit[0]).indexOf(nameToPrint) != -1) {
									fileFound = true;
								}
							}
							var statusMess = '';
							if (fileListResults.length == 0) {
								//		        		log.debug('entered no file list length');
								failCount = failCount + 1;
								totalCount = totalCount + 1;
								statusMess = 'Failed. Statement not generated.';
							} else if (fileFound == true) {
								//		        		log.debug('entered found file match');
								successCount = successCount + 1;
								totalCount = totalCount + 1;
								statusMess = 'Success. Statement generated.';
							} else {
								//		        		log.debug('entered no file match found');
								failCount = failCount + 1;
								totalCount = totalCount + 1;
								statusMess = 'Failed. Statement not generated.';
							}
							//		        	emailBody += nameToPrint + '-         ' + statusMess + ', \n';
							emailBody += workerMapping + '-         ' + statusMess + ', \n';
							//	        	}
							//			}
							//	        	}
						}
					}
				}
			} else {
				var projectList = getListOfAllWorkerProjForOffice(subsidID, 'project');
				for (var m = 0; m < projectList.length; m++) {
					for (var l = 0; l < projectList.length; l++) {
						//			log.debug('worker mapping list to loop', workerList[l]);
						var projectID = projectList[l].getText({ name: 'custrecord_lc_project' });
						var projectMapping = projectList[l].getValue({ name: 'name' });
						var projectNumber = projectList[l].getValue({ name: 'custrecord_lc_project' });
						var workProjList = projectID.split(' ');
						var nameToPrint = workProjList[0];
						if (projectNumber == inputWorkerProjList[m]) {
							var fileFound = false;
							for (var k = 0; k < fileListResults.length; k++) {

								var fullName = fileListResults[k].getValue({ name: 'name' });
								var fileFullNameSplit = fullName.split('-');
								if ((fileFullNameSplit[0]).indexOf(nameToPrint) != -1) {
									fileFound = true;
								}
							}
							var statusMess = '';
							if (fileListResults.length == 0) {
								//		        		log.debug('entered no file list length');
								failCount = failCount + 1;
								totalCount = totalCount + 1;
								statusMess = 'Failed. Statement not generated.';
							} else if (fileFound == true) {
								//		        		log.debug('entered found file match');
								successCount = successCount + 1;
								totalCount = totalCount + 1;
								statusMess = 'Success. Statement generated.';
							} else {
								//		        		log.debug('entered no file match found');
								failCount = failCount + 1;
								totalCount = totalCount + 1;
								statusMess = 'Failed. Statement not generated.';
							}
							//		        	emailBody += nameToPrint + '-         ' + statusMess + ', \n';
							emailBody += projectMapping + '-         ' + statusMess + ', \n';
							//	        	}
							//			}
							//	        	}
						}
					}
				}
			}

			//		log.debug('single email workerlist', workerList);


			emailBody += '\n Total No. : ' + totalCount.toString();
			emailBody += '\n No. of successful statements : ' + successCount.toString();
			emailBody += '\n No. of failed statements : ' + failCount.toString();
			emailBody += '\n\n - This is a system-generated email, please do not reply -';
			email.send({
				author: userid,
				recipients: userid,
				subject: 'Statement Run has been completed: ' + uniqueTime,
				body: emailBody
			});
			//		}
		}

		function checkTailEnd(postingper) {
			var incrementYear = false;
			var tailendList = ['Oct', 'Nov', 'Dec'];
			for (k = 0; k < tailendList.length; k++) {
				if ((postingper.indexOf(tailendList[k])) != -1) {
					incrementYear = true;
				}
			}
			return incrementYear;
		}

		function getIndexMonthEnd(postingPer) {
			var tailendList = ['Oct', 'Nov', 'Dec'];
			var monthList = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
			var indexNo = monthList.indexOf(postingPer);
			//		if ((tailendList.indexOf(postingPer) != -1) && (backward == true)) {
			//			indexNo = indexNo + 12;
			//		}
			indexNo = +indexNo + 12 + 1;
			return indexNo;
		}

		function getBudgetWithinPeriod(postingPer1, postingPer2, worker, classinput, subsidiary, cumulative, currencyInput, isProject, project, account) {


			//		var dateRaw1 = Date.parse('01 '+ postingPer1);
			var dateRaw2 = new Date(Date.parse('01 ' + postingPer2));
			//		var increase1 = checkTailEnd(postingPer1);
			var postingList2 = postingPer2.split(' ');
			var increase2 = checkTailEnd(postingPer2);
			if (increase2) {
				//minus
				var finYear = (+(postingList2[postingList2.length - 1]) + 1);
			} else {
				var finYear = +(postingList2[postingList2.length - 1]);
			}
			var monthString2 = postingList2[0];
			var yearinput2Less = +finYear - 1;
			if (isProject == false) {
				var budgetSearch = search.create({
					type: 'customrecord_lc_ps_budgetmapping',
					columns: [
						'name',
						'custrecord_lc_ps_budget_year',
						'custrecord_lc_ps_budget_period_1',
						'custrecord_lc_ps_budget_period_2',
						'custrecord_lc_ps_budget_period_3',
						'custrecord_lc_ps_budget_period_4',
						'custrecord_lc_ps_budget_period_5',
						'custrecord_lc_ps_budget_period_6',
						'custrecord_lc_ps_budget_period_7',
						'custrecord_lc_ps_budget_period_8',
						'custrecord_lc_ps_budget_period_9',
						'custrecord_lc_ps_budget_period_10',
						'custrecord_lc_ps_budget_period_11',
						'custrecord_lc_ps_budget_period_12',
						'custrecord_lc_ps_budget_worker',
						'custrecord_lc_ps_budget_class',
						'custrecord_lc_ps_budget_subsidiary',
						'custrecord_lc_ps_currency'
					],
					filters: [
						['custrecord_lc_ps_budget_worker', 'is', worker],
						'and', ['custrecord_lc_ps_budget_class', 'is', classinput],
						'and', ['custrecord_lc_ps_budget_subsidiary', 'is', subsidiary],
						'and', ['custrecord_lc_ps_budget_year', 'is', ('FY ' + finYear)],
						'and', ['isinactive', 'is', false]
					]
				});

				var budgetResults = budgetSearch.run().getRange({
					start: 0,
					end: 1000
				});
				var budgetBeforeSearch = search.create({
					type: 'customrecord_lc_ps_budgetmapping',
					columns: [
						'name',
						'custrecord_lc_ps_budget_year',
						'custrecord_lc_ps_budget_period_1',
						'custrecord_lc_ps_budget_period_2',
						'custrecord_lc_ps_budget_period_3',
						'custrecord_lc_ps_budget_period_4',
						'custrecord_lc_ps_budget_period_5',
						'custrecord_lc_ps_budget_period_6',
						'custrecord_lc_ps_budget_period_7',
						'custrecord_lc_ps_budget_period_8',
						'custrecord_lc_ps_budget_period_9',
						'custrecord_lc_ps_budget_period_10',
						'custrecord_lc_ps_budget_period_11',
						'custrecord_lc_ps_budget_period_12',
						'custrecord_lc_ps_budget_worker',
						'custrecord_lc_ps_budget_class',
						'custrecord_lc_ps_budget_subsidiary',
						'custrecord_lc_ps_currency'
					],
					filters: [
						['custrecord_lc_ps_budget_worker', 'is', worker],
						'and', ['custrecord_lc_ps_budget_class', 'is', classinput],
						'and', ['custrecord_lc_ps_budget_subsidiary', 'is', subsidiary],
						'and', ['custrecord_lc_ps_budget_year', 'is', ('FY ' + yearinput2Less)],
						'and', ['isinactive', 'is', false]
					]
				});

				var budgetBeforeResults = budgetBeforeSearch.run().getRange({
					start: 0,
					end: 1000
				});
			} else if (isProject == true) {
				var budgetSearch = search.create({
					type: 'customrecord_lc_ps_budgetmapping',
					columns: [
						'name',
						'custrecord_lc_ps_budget_year',
						'custrecord_lc_ps_budget_period_1',
						'custrecord_lc_ps_budget_period_2',
						'custrecord_lc_ps_budget_period_3',
						'custrecord_lc_ps_budget_period_4',
						'custrecord_lc_ps_budget_period_5',
						'custrecord_lc_ps_budget_period_6',
						'custrecord_lc_ps_budget_period_7',
						'custrecord_lc_ps_budget_period_8',
						'custrecord_lc_ps_budget_period_9',
						'custrecord_lc_ps_budget_period_10',
						'custrecord_lc_ps_budget_period_11',
						'custrecord_lc_ps_budget_period_12',
						'custrecord_lc_ps_budget_project',
						'custrecord_lc_ps_budget_account',
						'custrecord_lc_ps_budget_subsidiary',
						'custrecord_lc_ps_currency'
					],
					filters: [
						['custrecord_lc_ps_budget_project', 'is', project],
						'and', ['custrecord_lc_ps_budget_account', 'is', account],
						'and', ['custrecord_lc_ps_budget_subsidiary', 'is', subsidiary],
						'and', ['custrecord_lc_ps_budget_year', 'is', ('FY ' + finYear)],
						'and', ['isinactive', 'is', false]
					]
				});

				var budgetResults = budgetSearch.run().getRange({
					start: 0,
					end: 1000
				});
				var budgetBeforeSearch = search.create({
					type: 'customrecord_lc_ps_budgetmapping',
					columns: [
						'name',
						'custrecord_lc_ps_budget_year',
						'custrecord_lc_ps_budget_period_1',
						'custrecord_lc_ps_budget_period_2',
						'custrecord_lc_ps_budget_period_3',
						'custrecord_lc_ps_budget_period_4',
						'custrecord_lc_ps_budget_period_5',
						'custrecord_lc_ps_budget_period_6',
						'custrecord_lc_ps_budget_period_7',
						'custrecord_lc_ps_budget_period_8',
						'custrecord_lc_ps_budget_period_9',
						'custrecord_lc_ps_budget_period_10',
						'custrecord_lc_ps_budget_period_11',
						'custrecord_lc_ps_budget_period_12',
						'custrecord_lc_ps_budget_project',
						'custrecord_lc_ps_budget_account',
						'custrecord_lc_ps_budget_subsidiary',
						'custrecord_lc_ps_currency'
					],
					filters: [
						['custrecord_lc_ps_budget_project', 'is', project],
						'and', ['custrecord_lc_ps_budget_account', 'is', account],
						'and', ['custrecord_lc_ps_budget_subsidiary', 'is', subsidiary],
						'and', ['custrecord_lc_ps_budget_year', 'is', ('FY ' + yearinput2Less)],
						'and', ['isinactive', 'is', false]
					]
				});

				var budgetBeforeResults = budgetBeforeSearch.run().getRange({
					start: 0,
					end: 1000
				});
			}
			var amountList = [];
			var totalBudget = 0.00;   //eg input posting period main is Jan 2021



			//		log.debug('subsid currency budget', currencyInput);
			if (budgetBeforeResults.length != 0) {
				var currencyBudget = budgetBeforeResults[0].getText({ name: 'custrecord_lc_ps_currency' });
				//			log.debug('budget currency 1', currencyBudget);
				var oldYearBudget1 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_1' });
				var oldYearBudget2 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_2' });
				var oldYearBudget3 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_3' });
				var oldYearBudget4 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_4' });
				var oldYearBudget5 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_5' });
				var oldYearBudget6 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_6' });
				var oldYearBudget7 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_7' });
				var oldYearBudget8 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_8' });
				var oldYearBudget9 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_9' });
				var oldYearBudget10 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_10' });
				var oldYearBudget11 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_11' });
				var oldYearBudget12 = budgetBeforeResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_12' });
			} else {
				var oldYearBudget1 = "";
				var oldYearBudget2 = "";
				var oldYearBudget3 = "";
				var oldYearBudget4 = "";
				var oldYearBudget5 = "";
				var oldYearBudget6 = "";
				var oldYearBudget7 = "";
				var oldYearBudget8 = "";
				var oldYearBudget9 = "";
				var oldYearBudget10 = "";
				var oldYearBudget11 = "";
				var oldYearBudget12 = "";
			}

			if (budgetResults.length != 0) {
				var currencyBudget2 = budgetResults[0].getText({ name: 'custrecord_lc_ps_currency' });
				//			log.debug('budget currency 2', currencyBudget2);
				var yearBudget1 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_1' });
				var yearBudget2 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_2' });
				var yearBudget3 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_3' });
				var yearBudget4 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_4' });
				var yearBudget5 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_5' });
				var yearBudget6 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_6' });
				var yearBudget7 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_7' });
				var yearBudget8 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_8' });
				var yearBudget9 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_9' });
				var yearBudget10 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_10' });
				var yearBudget11 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_11' });
				var yearBudget12 = budgetResults[0].getValue({ name: 'custrecord_lc_ps_budget_period_12' });

			} else {
				var yearBudget1 = "";
				var yearBudget2 = "";
				var yearBudget3 = "";
				var yearBudget4 = "";
				var yearBudget5 = "";
				var yearBudget6 = "";
				var yearBudget7 = "";
				var yearBudget8 = "";
				var yearBudget9 = "";
				var yearBudget10 = "";
				var yearBudget11 = "";
				var yearBudget12 = "";
			}

			if (((oldYearBudget1) && (oldYearBudget1 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget1), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget1);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget2) && (oldYearBudget2 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget2), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget2);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget3) && (oldYearBudget3 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget3), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget3);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget4) && (oldYearBudget4 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget4), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget4);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget5) && (oldYearBudget5 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget5), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget5);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget6) && (oldYearBudget6 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget6), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget6);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget7) && (oldYearBudget7 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget7), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget7);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget8) && (oldYearBudget8 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget8), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget8);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget9) && (oldYearBudget9 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget9), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget9);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget10) && (oldYearBudget10 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget10), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget10);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget11) && (oldYearBudget11 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget11), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget11);
			} else {
				amountList.push('0.00');
			}
			if (((oldYearBudget12) && (oldYearBudget12 != "")) && (budgetBeforeResults.length != 0)) {
				//			amountList.push(convertMyCurrency((oldYearBudget12), currencyBudget, currencyInput)); 
				amountList.push(oldYearBudget12);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget1) && (yearBudget1 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget1), currencyBudget, currencyInput)); 
				amountList.push(yearBudget1);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget2) && (yearBudget2 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget2), currencyBudget, currencyInput)); 
				amountList.push(yearBudget2);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget3) && (yearBudget3 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget3), currencyBudget, currencyInput)); 
				amountList.push(yearBudget3);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget4) && (yearBudget4 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget4), currencyBudget, currencyInput)); 
				amountList.push(yearBudget4);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget5) && (yearBudget5 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget5), currencyBudget, currencyInput)); 
				amountList.push(yearBudget5);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget6) && (yearBudget6 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget6), currencyBudget, currencyInput)); 
				amountList.push(yearBudget6);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget7) && (yearBudget7 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget7), currencyBudget, currencyInput)); 
				amountList.push(yearBudget7);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget8) && (yearBudget8 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget8), currencyBudget, currencyInput));
				amountList.push(yearBudget8);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget9) && (yearBudget9 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget9), currencyBudget, currencyInput)); 
				amountList.push(yearBudget9);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget10) && (yearBudget10 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget10), currencyBudget, currencyInput)); 
				amountList.push(yearBudget10);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget11) && (yearBudget11 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget11), currencyBudget, currencyInput)); 
				amountList.push(yearBudget11);
			} else {
				amountList.push('0.00');
			}
			if (((yearBudget12) && (yearBudget12 != "")) && (budgetResults.length != 0)) {
				//			amountList.push(convertMyCurrency((yearBudget12), currencyBudget, currencyInput)); 
				amountList.push(yearBudget12);
			} else {
				amountList.push('0.00');
			}

			var indexEnd = getIndexMonthEnd(monthString2);

			var indexLength = getIndexLength(postingPer1, postingPer2);
			//		if (cumulative == true) {
			//			indexEnd = +indexEnd + 1;
			//			indexLength = +indexLength + 1;
			//		}
			var startIndex = +indexEnd - +indexLength;
			//		log.debug('start index is ', startIndex);
			//		log.debug('ending index is ', indexEnd);

			for (b = startIndex; b < indexEnd; b++) {
				totalBudget = (+totalBudget + +(amountList[b])).toFixed(2);
				//			log.debug('incremental budget', totalBudget);
			}
			return totalBudget;
		}


		function getProjectWorkerCode(recordID, type) {
			if (type == 'worker') {
				var projWorkSearch = search.create({
					type: 'customrecord_cseg_lc_worker',
					columns: [
						'name'
					],
					filters: [
						['internalid', 'is', recordID]
					]
				});

				var projWorkResults = projWorkSearch.run().getRange({
					start: 0,
					end: 10
				});

			} else {
				var projWorkSearch = search.create({
					type: 'customrecord_cseg_lc_project',
					columns: [
						'name'
					],
					filters: [
						['internalid', 'is', recordID]
					]
				});

				var projWorkResults = projWorkSearch.run().getRange({
					start: 0,
					end: 10
				});

			}

			var projWorkName = projWorkResults[0].getValue({ name: 'name' });
			return projWorkName;
		}

		function updateParentTracker(parentTrackerID, message) {
			var parentTrackerObj = record.load({
				type: 'customrecord_lc_ps_gen_tracker',
				id: parentTrackerID,
			});
			parentTrackerObj.setValue('custrecord_lc_ps_gen_message', message);
			parentTrackerObj.setValue('custrecord_lc_ps_gen_tracker_status', message);

			parentTrackerObj.save();
		}
		function searchAndUpdateChildTrackers(parentTrackerId, childID, message, fileID) {
			var childIDString = childID.toString();
			var childTrackerSearch = search.create({
				type: 'customrecord_lc_ps_gen_tracker',
				columns: [
					'custrecord_lc_ps_gen_tracker_date',
					'custrecord_lc_ps_gen_tracker_printby',
					'custrecord_lc_ps_gen_tracker_status',
					'custrecord_lc_ps_gen_tracker_action',
					'custrecord_lc_ps_gen_tracker_printfor',
					'custrecord_lc_ps_gen_parenttracker',
					'custrecord_lc_ps_gen_isparent',
					'custrecord_lc_ps_gen_projwork',
					'custrecord_lc_ps_gen_subject',
					'custrecord_lc_ps_gen_message'
				],
				filters: [
					['custrecord_lc_ps_gen_parenttracker', 'is', parentTrackerId],
					'and', ['custrecord_lc_ps_gen_isparent', 'is', false],
					'and', ['custrecord_lc_ps_gen_projwork', 'is', childID]
				]
			});

			var childTrackerResults = childTrackerSearch.run().getRange({
				start: 0,
				end: 1000
			});
			//			log.debug('child tracker result', childTrackerResults);
			var childTrackerLoadID = childTrackerResults[0].id;
			var childTrackerObj = record.load({
				type: 'customrecord_lc_ps_gen_tracker',
				id: childTrackerLoadID,
			});
			childTrackerObj.setValue('custrecord_lc_ps_gen_message', message);
			childTrackerObj.setValue('custrecord_lc_ps_gen_tracker_status', message);
			if ((fileID) && (fileID != "")) {
				childTrackerObj.setValue('custrecord_lc_ps_gen_tracker_fileid', fileID);
			}

			childTrackerObj.save();
			return true;
		}

		function stringifyCurrency(inputCurr) {
			var numberVal = +inputCurr;
			if (numberVal < 0) {
				return '(' + numberWithCommas((Math.abs(numberVal).toFixed(2))) + ')';
			} else {
				return numberWithCommas(numberVal.toFixed(2));
			}
		}

		function stringifyCurrencyExpense(inputCurr) {
			var numberVal = +inputCurr;
			if (numberVal < 0) {
				return '(' + (Math.abs(numberVal).toFixed(2)).toString() + ')';
				//			return inputCurr;
			} else {
				//			return inputCurr;
				return '(' + (Math.abs(numberVal).toFixed(2)).toString() + ')';
			}
		}

		function generatePDF_XML(entireInputStructure, summaryStructure, postPer, budgetParam, currencySub, subsidiaryString, subsidID, interfundNumber) {
			var classOrderListByName = ['Support', 'Housing', 'Passage', 'Medical', 'MK Education', 'ool', 'Future Support', 'Retirement', 'Ministry'];
			var classOrderListByID = ['2', '3', '5', '4', '12', '13', '14', '7'];


			//		log.debug('summary structure data to xml', summaryStructure);
			var xml = "<?xml version='1.0' encoding='UTF-8'?>\n" +
				"<!DOCTYPE pdf PUBLIC '-//big.faceless.org//report' 'report-1.1.dtd'>\n" +
				"<pdf lang='ru-RU' xml:lang='ru-RU'>\n" +
				"<head>\n" +
				"<style>" +
				"body{font-family: Helvetica,Courier New;text-align: left;font-size: 10px;size : Letter-LANDSCAPE}" +
				"h2{text-transform: uppercase;font-size: 14px;}" +
				".header{font-size: 11px;font-weight: bold;size: Letter-LANDSCAPE;}" +
				".footer{font-size: 11px;color: #bdbdbd;}" +
				".dark{font-size: 11px;font-weight: bold ;}" +
				".light{font-size: 11px;font-style: italic;}" +
				".deepshadetop{border-top: 1px black;}" +
				".deepshadebot{border-top: 1px black; border-bottom: 1px black;}" +
				".deepshadehalf{border-bottom: 1px black; border-style: solid double dashed;}" +
				".shade {background-color: #f2f6fc;}" +
				".billitem{font-size: 10px;font-weight: bold;}" +
				".glitem{font-size: 8px;font-weight: normal ;font-style: italic;}" +
				"table tr th{color: #000;page-break-inside: avoid;break-inside: avoid;}" +
				"</style>" +
				"<macrolist>" +
				'<macro id="header">' +
				'<table width="100%" border="0" cellmargin="3" style="margin-top: -10px;">' +
				'<tr>' +
				'<td align="left" colspan="2"><h2>Worker Account Statement</h2></td>' +
				'<td align="right" colspan="2"><h2>' + entireInputStructure.subsidiary + '</h2></td>' +
				'</tr>' +
				'</table>' +
				'<table width="100%" border="0" cellmargin="3" style="padding-top:5px;">' +
				'<tr>' +
				'<td width="70%"><table>' +
				'<tr><td><b>Report Type: </b></td><td>' + entireInputStructure.reporttype + '</td></tr>' +
				'<tr><td><b>Worker ID: </b></td><td>' + entireInputStructure.projectid + '</td></tr>' +
				'<tr><td><b>Currency: </b></td><td>' + entireInputStructure.currency + '</td></tr>' +
				'<tr><td><b>Period: </b></td><td>' + entireInputStructure.postingperiod + '</td></tr>' +
				'</table></td>' +
				'<td width="30%" align="right"><table>' +
				'<tr><td><b>Date Printed: </b></td><td>' + entireInputStructure.timestamp + ' </td></tr>' +
				//	       '<tr><td><b>Date Printed: </b></td><td>'+ entireInputStructure.timestamp +' </td></tr>' +
				'<tr><td><b>Printed By: </b></td><td>' + entireInputStructure.printedby + '</td></tr>' +
				'</table></td>' +
				'</tr>' +
				'</table>' +
				"</macro>" +
				"</macrolist>" +
				"<macrolist>" +
				'<macro id="myfooter">' +
				'<p align="center">Page <pagenumber size="2"/> of <totalpages size="2"/></p>' +
				'</macro>' +
				"</macrolist>" +
				"</head>\n";
			xml += '<body size="A4-LANDSCAPE" header="header" header-height="45mm" footer="myfooter" footer-height="10mm">';
			//This is the summary parts
			var classListSummary = summaryStructure.classlist;
			var classNameListSummary = summaryStructure.classnamelist;
			var openingBalSummary = summaryStructure.openingbalancelist;
			var incomeListSummary = summaryStructure.incomelist;
			var expenseListSummary = summaryStructure.expenselist;
			var transferListSummary = summaryStructure.transferlist;
			var surplusListSummary = summaryStructure.surpluslist;
			var closingBalanceListSummary = summaryStructure.closingbalancelist;
			var unsortedpersonalAccountList = entireInputStructure.personalaccount;
			var personalAccountOpening = entireInputStructure.personalaccountopening;
			var unsortedfringeBenefitList = entireInputStructure.fringebenefit;
			var fringeBenefitOpening = entireInputStructure.fringebenefitopening;
			var budgetline1 = budgetParam.line1;
			var budgetline2 = budgetParam.line2;
			var budgetline3 = budgetParam.line3;
			//		log.debug('budgetline3 in pdf', budgetline3);
			//		log.debug('renderer summary class list view and length', classListSummary);
			xml += '<p><b><u>Summary</u></b></p>';
			xml += '<table width="100%" border="0" page-break-inside="avoid" break-inside= "avoid"><thead><tr>';
			xml += '<th align="left"> </th>' +
				'<th colspan="8"></th>';
			xml += '</tr></thead><tbody>';
			xml += '<tr>' +
				'<th align="left"></th>';
			for (var k = 0; k < classListSummary.length; k++) {
				// 		log.debug('class list loop renderer', classListSummary[k]);
				var formatClassNameList = classListSummary[k].split(':');
				xml += '<th align="center"><b>' + (formatClassNameList[(formatClassNameList.length - 1)]).toString().trim() + '</b></th>';

			}
			xml += '</tr>';
			xml += '<tr class="deepshadetop">' +
				'<th align="left">Opening surplus/(deficit)</th>';
			for (var k = 0; k < openingBalSummary.length; k++) {
				//		log.debug('class list loop renderer', openingBalSummary[k]);
				var openingBal = openingBalSummary[k];
				xml += '<th align="right" style="padding-right: 2px;"><b>' + openingBal + '</b></th>';

			}
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left">-</th>';
			for (var k = 0; k < classListSummary.length; k++) {
				xml += '<th align="justify"><b> </b></th>';

			}
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left">Income</th>';
			for (var k = 0; k < incomeListSummary.length; k++) {
				// 		log.debug('class list loop renderer', incomeListSummary[k]);
				var income = incomeListSummary[k];
				xml += '<th align="right" style="padding-right: 2px;">' + income + '</th>';

			}
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left">Expense</th>';
			for (var k = 0; k < expenseListSummary.length; k++) {
				//		log.debug('class list loop renderer', expenseListSummary[k]);
				var expense = expenseListSummary[k];
				xml += '<th align="right" style="padding-right: 2px;">' + expense + '</th>';

			}
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left">Transfer (out)/in</th>';
			for (var k = 0; k < transferListSummary.length; k++) {
				//		log.debug('class list loop renderer', transferListSummary[k]);
				var transfer = transferListSummary[k];
				xml += '<th align="right" style="padding-right: 2px;">' + transfer + '</th>';

			}
			xml += '</tr>';
			xml += '<tr class="deepshadebot">' +
				'<th align="left">Net surplus/(deficit)</th>';
			for (var k = 0; k < surplusListSummary.length; k++) {
				//		log.debug('class list loop renderer', surplusListSummary[k]);
				var surplus = surplusListSummary[k];
				xml += '<th align="right" style="padding-right: 2px;">' + surplus + '</th>';

			}
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left">-</th>';
			for (var k = 0; k < classListSummary.length; k++) {
				xml += '<th align="justify"><b></b></th>';

			}
			xml += '</tr>';
			xml += '<tr class="deepshadehalf">' +
				'<th align="left">Closing surplus/(deficit)</th>';
			for (var k = 0; k < closingBalanceListSummary.length; k++) {
				//		log.debug('class list loop renderer', closingBalanceListSummary[k]);
				var closingBal = closingBalanceListSummary[k];
				xml += '<th align="right" style="padding-right: 2px;"><b>' + closingBal + '</b></th>';

			}
			xml += '</tr>';

			xml += '</tbody></table><br/>';
			//This is the support analysis mini table
			xml += '<table width="50%" border="1" page-break-inside="avoid" break-inside= "avoid" align="center"><thead><tr>';
			xml += '<th align="center" colspan="4"><b>Support Analysis</b></th>';
			xml += '</tr></thead>';
			xml += '<tbody>';
			xml += '<tr class="deepshadetop">' +
				'<th align="center"><b> </b></th>' +
				'<th align="center"><b><u>Actual</u></b></th>' +
				'<th align="center"><b><u>Budget</u></b></th>' +
				'<th align="center"><b><u>Percentage</u></b></th>';
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="center"><b>' + postPer.toString() + '</b></th>';
			for (var k = 0; k < budgetline1.length; k++) {
				var val = budgetline1[k];
				// xml += '<th align="right" style="padding-right: 2px;">' + val + '</th>';
				xml += '<th align="center">' + val + '</th>';
			}
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="center"><b>Year to Date</b></th>';
			for (var k = 0; k < budgetline2.length; k++) {
				var val = budgetline2[k];
				// xml += '<th align="right" style="padding-right: 2px;">' + val + '</th>';
				xml += '<th align="center">' + val + '</th>';

			}
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="center"><b>Last 12 Months</b></th>';
			for (var k = 0; k < budgetline3.length; k++) {
				var val = budgetline3[k];
				// xml += '<th align="right" style="padding-right: 2px;">' + val + '</th>';
				xml += '<th align="center">' + val + '</th>';

			}
			xml += '</tr>';
			xml += '</tbody></table><br/>';
			var personalAccountList = [];
			if (unsortedpersonalAccountList.length != 0) {



				for (var u = 0; u < unsortedpersonalAccountList.length; u++) {
					var rawTranDateList = (unsortedpersonalAccountList[u].trandate).split('/');
					// log.debug('raw tran date list', rawTranDateList);
					var sortTranDate = Date.parse(new Date(rawTranDateList[1] + '/' + rawTranDateList[0] + '/' + rawTranDateList[2]));
					// log.debug('sorted Tran Date value', sortTranDate);
					var object2Push = unsortedpersonalAccountList[u];
					object2Push.sorttrandate = +sortTranDate;
					personalAccountList.push(object2Push);

				}


			}

			personalAccountList.sort(compareTranDate);

			if (personalAccountList.length != 0) {
				var personalAccountclosing = +personalAccountOpening;
				var creditAccum = 0.00;
				var debitAccum = 0.00;
				xml += '<table width="100%" border="0" page-break-inside="avoid" break-inside= "avoid"><thead><tr>';
				xml += '<th align="left" colspan="2"><u>Personal account</u></th>' + '<th colspan="1"></th>' + '<th width="33%"></th>' + '<th colspan="2"></th>';
				xml += '<th align="right" colspan="2">Opening surplus/(deficit)</th>';
				xml += '<th align="right" width="7%">' + stringifyCurrency(personalAccountOpening) + '</th>';

				xml += '</tr></thead><tbody>';
				xml += '<tr class="deepshadetop">' +
					'<th align="left" width="10%"><b>Date</b></th>' +
					'<th align="left" width="14%"><b>Trans ID</b></th>' +
					'<th align="left" width="7%"><b>Account</b></th>' +
					'<th align="left" width="33%"><b>Memo</b></th>' +
					'<th align="left"></th>' +
					'<th align="left"></th>' +
					'<th align="center" width="7%"><b>Debit</b></th>' +
					'<th align="center" width="7%" style="padding-right: 12px;"><b>Credit</b></th>' +
					'<th align="center" width="7%"><b>Balance</b></th>' +

					'</tr>';
				for (var u = 0; u < personalAccountList.length; u++) {
					//			   log.debug('personal account line', personalAccountList[u]);
					var currencyLine = personalAccountList[u].currency[0].text;
					var debitAmount = personalAccountList[u].debitamount;
					var creditAmount = personalAccountList[u].creditamount;
					var lineExchangeRate = personalAccountList[u].exchangerate;
					var lineSubsidiary = personalAccountList[u].custcol_lc_subsidiary_line;
					//    		   var plainAmount = makeItCurrency((personalAccountList[u].amount), currency);
					var plainAmount = (Math.abs(convertMyCurrency((personalAccountList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2);
					var postingPerRow = personalAccountList[u].postingperiod[0].text;
					var accountType = personalAccountList[u].account[0].value;
					var recType = personalAccountList[u].type[0].value;
					var tranType = personalAccountList[u].accounttype;
					if ((((postingPerRow == postPer) && ((((debitAmount > 0) && (debitAmount != "")) || ((creditAmount > 0) && (creditAmount != "")))))) &&
						(((!lineSubsidiary) || (lineSubsidiary == "")) || (subsidiaryString == lineSubsidiary))) {
						xml += '<tr>';
						xml += '<th align="left" width="10%">' + personalAccountList[u].trandate + '</th>';
						var tranIDText = personalAccountList[u].tranid;
						if (((!tranIDText) || (tranIDText == "")) || (recType == 'VPrep')) {
							xml += '<th align="left" width="14%">' + personalAccountList[u].transactionnumber + '</th>';
						} else {
							xml += '<th align="left" width="14%">' + personalAccountList[u].tranid + '</th>';
						}
						var accountFullText = (personalAccountList[u].account)[0].text;
						var accountTextSplit = accountFullText.split(' ');
						xml += '<th align="left" width="7%">' + accountTextSplit[0] + '</th>';
						xml += '<th align="left" width="33%">' + personalAccountList[u].memo + '</th>';
						xml += '<th align="left"></th>';
						xml += '<th align="left"></th>';
						// xml += '<th align="left"></th>';
						var debitInstance = personalAccountList[u].debitamount;
						var creditInstance = personalAccountList[u].creditamount;
						if ((debitInstance) && (debitInstance > 0)) {
							xml += '<th align="right" width="7%">' + stringifyCurrency((Math.abs(convertMyCurrency((personalAccountList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
							xml += '<th align="right" width="7%" style="padding-right: 12px;"></th>';
						} else {
							xml += '<th align="right" width="7%"></th>';
							xml += '<th align="right" width="7%" style="padding-right: 12px;">' + stringifyCurrency((Math.abs(convertMyCurrency((personalAccountList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
						}

						if ((debitAmount > 0) || (debitAmount != "")) {
							personalAccountclosing = (+personalAccountclosing - +plainAmount).toFixed(2);
							debitAccum += +plainAmount;
						} else {
							personalAccountclosing = (+personalAccountclosing + +plainAmount).toFixed(2);
							creditAccum += +plainAmount;
						}
						xml += '<th align="right" width="7%">' + stringifyCurrency((+personalAccountclosing).toFixed(2).toString()) + '</th>';
						// xml += '<th align="left" width="7%"></th>';
						xml += '</tr>';

					}


				}
				xml += '<tr class="deepshadebot">' +
					'<th align="left" width="10%"><b>Total</b></th>' +
					'<th align="left" width="14%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="33%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="right" colspan="2">Closing surplus/(deficit)</th>' +
					'<th align="right" width="7%">' + stringifyCurrency((+personalAccountclosing).toFixed(2).toString()) + '</th>' +

					'</tr>';
				xml += '</tbody></table><br/>';
			}
			var fringeBenefitList = [];
			if (unsortedfringeBenefitList.length != 0) {



				for (var u = 0; u < unsortedfringeBenefitList.length; u++) {
					var rawTranDateList = (unsortedfringeBenefitList[u].trandate).split('/');
					// log.debug('raw tran date list', rawTranDateList);
					var sortTranDate = Date.parse(new Date(rawTranDateList[1] + '/' + rawTranDateList[0] + '/' + rawTranDateList[2]));
					// log.debug('sorted Tran Date value', sortTranDate);
					var object2Push = unsortedfringeBenefitList[u];
					object2Push.sorttrandate = +sortTranDate;
					fringeBenefitList.push(object2Push);

				}


			}

			fringeBenefitList.sort(compareTranDate);
			if (fringeBenefitList.length != 0) {
				var fringeBenefitclosing = +fringeBenefitOpening;
				var creditAccum = 0.00;
				var debitAccum = 0.00;
				xml += '<table width="100%" border="0" page-break-inside="avoid" break-inside= "avoid"><thead><tr>';
				xml += '<th align="left" colspan="2"><u>Fringe benefit</u></th>' + '<th colspan="1"></th>' + '<th width="33%"></th>' + '<th colspan="2"></th>';

				xml += '<th align="right" colspan="2">Opening surplus/(deficit)</th>';
				xml += '<th align="right" width="7%">' + stringifyCurrency(fringeBenefitOpening) + '</th>';
				xml += '</tr></thead><tbody>';
				xml += '<tr class="deepshadetop">' +
					'<th align="left" width="10%"><b>Date</b></th>' +
					'<th align="left" width="14%"><b>Trans ID</b></th>' +
					'<th align="left" width="7%"><b>Account</b></th>' +
					'<th align="left" width="33%"><b>Memo</b></th>' +
					'<th align="left"></th>' +
					'<th align="left"></th>' +
					'<th align="center" width="7%"><b>Debit</b></th>' +
					'<th align="center" width="7%" style="padding-right: 12px;"><b>Credit</b></th>' +
					'<th align="center" width="7%"><b>Balance</b></th>' +

					'</tr>';
				for (var u = 0; u < fringeBenefitList.length; u++) {
					var currencyLine = fringeBenefitList[u].currency[0].text;
					var debitAmount = fringeBenefitList[u].debitamount;
					var creditAmount = fringeBenefitList[u].creditamount;
					var lineExchangeRate = fringeBenefitList[u].exchangerate;
					var lineSubsidiary = fringeBenefitList[u].custcol_lc_subsidiary_line;
					var plainAmount = (Math.abs(convertMyCurrency((fringeBenefitList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2);
					var postingPerRow = fringeBenefitList[u].postingperiod[0].text;
					var accountType = fringeBenefitList[u].account[0].value;
					var recType = fringeBenefitList[u].type[0].value;
					var tranType = fringeBenefitList[u].accounttype;
					if ((((postingPerRow == postPer) && ((((debitAmount > 0) && (debitAmount != "")) || ((creditAmount > 0) && (creditAmount != "")))))) &&
						(((!lineSubsidiary) || (lineSubsidiary == "")) || (subsidiaryString == lineSubsidiary))) {
						xml += '<tr>';
						xml += '<th align="left" width="10%">' + fringeBenefitList[u].trandate + '</th>';
						var tranIDText = fringeBenefitList[u].tranid;
						if (((!tranIDText) || (tranIDText == "")) || (recType == 'VPrep')) {
							xml += '<th align="left" width="14%">' + fringeBenefitList[u].transactionnumber + '</th>';
						} else {
							xml += '<th align="left" width="14%">' + fringeBenefitList[u].tranid + '</th>';
						}
						var accountFullText = (fringeBenefitList[u].account)[0].text;
						var accountTextSplit = accountFullText.split(' ');
						xml += '<th align="left" width="7%">' + accountTextSplit[0] + '</th>';
						xml += '<th align="left" width="33%">' + fringeBenefitList[u].memo + '</th>';
						xml += '<th align="left"></th>';
						xml += '<th align="left"></th>';
						// xml += '<th align="left"></th>';
						var debitInstance = fringeBenefitList[u].debitamount;
						var creditInstance = fringeBenefitList[u].creditamount;
						if ((debitInstance) && (debitInstance > 0)) {
							xml += '<th align="right" width="7%">' + stringifyCurrency((Math.abs(convertMyCurrency((fringeBenefitList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
							xml += '<th align="right" width="7%" style="padding-right: 12px;"></th>';
						} else {
							xml += '<th align="right" width="7%"></th>';
							xml += '<th align="right" width="7%" style="padding-right: 12px;">' + stringifyCurrency((Math.abs(convertMyCurrency((fringeBenefitList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
						}

						if ((debitAmount > 0) || (debitAmount != "")) {
							fringeBenefitclosing = (+fringeBenefitclosing - +plainAmount).toFixed(2);
							debitAccum += +plainAmount;
						} else {
							fringeBenefitclosing = (+fringeBenefitclosing + +plainAmount).toFixed(2);
							creditAccum += +plainAmount;
						}
						xml += '<th align="right" width="7%">' + stringifyCurrency((+fringeBenefitclosing).toFixed(2).toString()) + '</th>';
						// xml += '<th align="right" width="7%"></th>';
						xml += '</tr>';

					}


				}
				xml += '<tr class="deepshadebot">' +
					'<th align="left" width="10%"><b>Total</b></th>' +
					'<th align="left" width="14%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="33%"></th>' +
					'<th align="right" width="7%"></th>' +
					'<th align="right" width="7%"></th>' +
					'<th align="right" colspan="2">Closing surplus/(deficit)</th>' +
					'<th align="right" width="7%">' + stringifyCurrency((+fringeBenefitclosing).toFixed(2).toString()) + '</th>' +

					'</tr>';

				xml += '</tbody></table><br/>';
			}
			//This is the details transaction parts
			xml += '<p style="page-break-before: always;"><b>Detailed Transactions</b></p>';


			//		log.debug('total number of classes', entireInputStructure.transactions.length);

			for (var p = 0; p < classOrderListByName.length; p++) {
				var orderClassName = classOrderListByName[p];

				for (var w = 0; w < entireInputStructure.transactions.length; w++) {
					var unsortedlistTransByClass = entireInputStructure.transactions[w];
					var classOpeningBal = 100.00;
					var listTransByClass = [];
					if (unsortedlistTransByClass.length != 0) {
						for (var u = 0; u < unsortedlistTransByClass.length; u++) {
							var debitAmount = unsortedlistTransByClass[u].values.debitamount;
							var creditAmount = unsortedlistTransByClass[u].values.creditamount;
							var currencyLine = unsortedlistTransByClass[u].values.currency[0].text;
							var debitAmount = unsortedlistTransByClass[u].values.debitamount;
							var creditAmount = unsortedlistTransByClass[u].values.creditamount;
							var rawTranDateList = (unsortedlistTransByClass[u].values.trandate).split('/');
							// log.debug('raw tran date list', rawTranDateList);
							var sortTranDate = Date.parse(new Date(rawTranDateList[1] + '/' + rawTranDateList[0] + '/' + rawTranDateList[2]));
							// log.debug('sorted Tran Date value', sortTranDate);
							var object2Push = unsortedlistTransByClass[u];
							object2Push.sorttrandate = +sortTranDate;
							listTransByClass.push(object2Push);

						}
					}
					listTransByClass.sort(compareTranDate);
					// log.debug('sorted details tran list', listTransByClass);
					if (listTransByClass.length != 0) {
						//	        	   for (var p=0; p<classOrderListByName.length; p++) {
						// log.debug('row of detail tran', listTransByClass[0].values);
						var concatClassName = ((listTransByClass[0].values.class[0].text)).split(':');
						var classNameCompare = concatClassName[concatClassName.length - 1];
						if (classNameCompare.indexOf(orderClassName) != -1) {
							xml += '<table width="100%" border="0" page-break-inside="auto" break-inside= "auto"><thead><tr>';

							xml += '<th align="left" colspan="3"><u>Class: ' + classNameCompare + '</u></th>' +
								'<th align="left" width="33%"></th>' +
								'<th align="left" width="7%"></th>' +
								'<th align="left" width="7%"></th>' + '<th align="left" width="7%"></th>' + '<th align="left" width="10%"></th>' +
								'<th align="left" width="7%"></th>'
							xml += '</tr></thead><tbody>';
							xml += '<tr class="deepshadetop">' +
								'<th align="left" width="10%"><b>Date</b></th>' +
								'<th align="left" width="14%"><b>Trans ID</b></th>' +
								'<th align="left" width="7%"><b>Account</b></th>' +
								'<th align="left" width="33%"><b>Memo</b></th>' +
								'<th align="left" width="7%"></th>' +
								// '<th align="left"></th>' +
								// '<th align="left"></th>' +
								'<th align="left" width="7%"></th>' +
								'<th align="center" width="7%"><b>Debit</b></th>' +
								'<th align="center" width="7%" style="padding-right: 12px;"><b>Credit</b></th>' +
								'<th align="center" width="7%"><b>Net Change</b></th>' +

								'</tr>';
							var classAccumulation = classOpeningBal;
							var creditAccum = 0.00;
							var debitAccum = 0.00;
							for (var u = 0; u < listTransByClass.length; u++) {
								//	        		   if (orderClassName == concatClassName) {
								var currencyLine = listTransByClass[u].values.currency[0].text;
								var debitAmount = listTransByClass[u].values.debitamount;
								var creditAmount = listTransByClass[u].values.creditamount;
								var lineExchangeRate = listTransByClass[u].values.exchangerate;
								var lineSubsidiary = listTransByClass[u].values.custcol_lc_subsidiary_line;
								var mainSubsidiary = listTransByClass[u].values.subsidiary[0].value;
								var plainAmount = (Math.abs(convertMyCurrency((listTransByClass[u].values.fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2);
								var postingPerRow = listTransByClass[u].values.postingperiod[0].text;
								var accountType = listTransByClass[u].values.account[0].value;
								var recType = listTransByClass[u].values.type[0].value;
								var tranType = listTransByClass[u].values.accounttype;
								if ((((tranType == 'Expense') || (tranType == 'Income') || (accountType == interfundNumber)) &&
									((postingPerRow == postPer) && ((((debitAmount > 0) && (debitAmount != "")) || ((creditAmount > 0) && (creditAmount != "")))))) &&
									((((!lineSubsidiary) || (lineSubsidiary == "")) && (mainSubsidiary == subsidID)) || (subsidiaryString == lineSubsidiary))) {
									xml += '<tr>';
									xml += '<th align="left" width="10%">' + listTransByClass[u].values.trandate + '</th>';
									var tranIDText = listTransByClass[u].values.tranid;
									if (((!tranIDText) || (tranIDText == "")) || (recType == 'VPrep')) {
										xml += '<th align="left" width="14%">' + listTransByClass[u].values.transactionnumber + '</th>';
									} else {
										xml += '<th align="left" width="14%">' + listTransByClass[u].values.tranid + '</th>';
									}
									var accountFullText = (listTransByClass[u].values.account)[0].text;
									var accountTextSplit = accountFullText.split(' ');
									xml += '<th align="left" width="7%">' + accountTextSplit[0] + '</th>';
									xml += '<th align="left" width="33%">' + listTransByClass[u].values.memo + '</th>';
									xml += '<th align="left" width="7%"></th>';
									// xml += '<th align="left"></th>';
									xml += '<th align="left" width="7%"></th>';
									// xml += '<th align="left"></th>';
									var debitInstance = listTransByClass[u].values.debitamount;
									var creditInstance = listTransByClass[u].values.creditamount;
									if ((debitInstance) && (debitInstance > 0)) {
										xml += '<th align="right" width="7%">' + stringifyCurrency((Math.abs(convertMyCurrency((listTransByClass[u].values.fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
										xml += '<th align="right" width="7%" style="padding-right: 12px;"></th>';
									} else {
										xml += '<th align="right" width="7%"></th>';
										xml += '<th align="right" width="7%" style="padding-right: 12px;">' + stringifyCurrency((Math.abs(convertMyCurrency((listTransByClass[u].values.fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
									}


									if ((debitAmount > 0) || (debitAmount != "")) {
										classAccumulation = +classAccumulation + plainAmount;
										debitAccum += +plainAmount;
									} else {
										classAccumulation = +classAccumulation - +plainAmount;
										creditAccum += +plainAmount;
									}
									//		        		   log.debug('class accumulation value', classAccumulation);
									//		        		   xml += '<th align="right" width="10%">' + classAccumulation.toString() + '</th>';

									xml += '<th align="right" width="7%"></th>';
									xml += '</tr>';

								}
								//	        	   }
							}
							xml += '<tr class="deepshadebot">' +
								'<th align="left" width="10%"><b>Total</b></th>' +
								'<th align="left" width="14%"></th>' +
								'<th align="left" width="7%"></th>' +
								'<th align="left" width="33%"></th>' +
								'<th align="left" width="7%"></th>' +
								// '<th align="left"></th>' +
								// '<th align="left"></th>' +
								'<th align="left" width="7%"></th>' +
								'<th align="right" width="7%">' + stringifyCurrency(debitAccum.toFixed(2).toString()) + '</th>' +
								'<th align="right" width="7%" style="padding-right: 12px;">' + stringifyCurrency(creditAccum.toFixed(2).toString()) + '</th>' +
								'<th align="right" width="7%">' + stringifyCurrency((+creditAccum - +debitAccum).toFixed(2).toString()) + '</th>' +

								'</tr>';
							xml += '</tbody></table><br/>';
						}
					}
				}
			}
			xml += '</body></pdf>';
			return xml;
		}

		function generatePDF_XML_proj(entireInputStructure, summaryStructure, postPer, budgetParam, currencySub, subsidiaryString, projSummaryParam, interfundNumber) {
			//		log.debug('summary structure data to xml', summaryStructure);
			var xml = "<?xml version='1.0' encoding='UTF-8'?>\n" +
				"<!DOCTYPE pdf PUBLIC '-//big.faceless.org//report' 'report-1.1.dtd'>\n" +
				"<pdf lang='ru-RU' xml:lang='ru-RU'>\n" +
				"<head>\n" +
				"<style>" +
				"body{font-family: Helvetica,Courier New;text-align: left;font-size: 10px;size : Letter-LANDSCAPE}" +
				"h2{text-transform: uppercase;font-size: 14px;}" +
				".header{font-size: 11px;font-weight: bold;size: Letter-LANDSCAPE;}" +
				".footer{font-size: 11px;color: #bdbdbd;}" +
				".dark{font-size: 11px;font-weight: bold ;}" +
				".light{font-size: 11px;font-style: italic;}" +
				".deepshadetop{border-top: 1px black;}" +
				".deepshadevert{border-right: 1px black;}" +
				".deepshadebot{border-top: 1px black; border-bottom: 1px black;}" +
				".deepshadebotsingle{border-bottom: 1px black;}" +
				".deepshadehalf{border-bottom: double black 3px;}" +
				".shade {background-color: #f2f6fc;}" +
				".billitem{font-size: 10px;font-weight: bold;}" +
				".glitem{font-size: 8px;font-weight: normal ;font-style: italic;}" +
				"table tr th{color: #000;page-break-inside: avoid;break-inside: avoid;}" +
				"</style>" +
				"<macrolist>" +
				'<macro id="header">' +
				'<table width="100%" border="0" cellmargin="3" style="margin-top: -10px;">' +
				'<tr>' +
				'<td align="left" colspan="2"><h2>Project Account Statement</h2></td>' +
				'<td align="right" colspan="2"><h2>' + entireInputStructure.subsidiary + '</h2></td>' +
				'</tr>' +
				'</table>' +
				'<table width="100%" border="0" cellmargin="3" style="padding-top:5px;">' +
				'<tr>' +
				'<td width="70%"><table>' +
				'<tr><td><b>Report Type: </b></td><td>' + entireInputStructure.reporttype + '</td></tr>' +
				'<tr><td><b>Project ID: </b></td><td>' + entireInputStructure.projectid + '</td></tr>' +
				'<tr><td><b>Currency: </b></td><td>' + entireInputStructure.currency + '</td></tr>' +
				'<tr><td><b>Period: </b></td><td>' + entireInputStructure.postingperiod + '</td></tr>' +
				'</table></td>' +
				'<td width="30%" align="right"><table>' +
				'<tr><td><b>Date Printed: </b></td><td>' + entireInputStructure.timestamp + ' </td></tr>' +
				'<tr><td><b>Printed By: </b></td><td>' + entireInputStructure.printedby + '</td></tr>' +
				'</table></td>' +
				'</tr>' +
				'</table>' +
				"</macro>" +
				"</macrolist>" +
				"<macrolist>" +
				'<macro id="myfooter">' +
				'<p align="center">Page <pagenumber size="2"/> of <totalpages size="2"/></p>' +
				'</macro>' +
				"</macrolist>" +
				"</head>\n";
			xml += '<body size="A4-LANDSCAPE" header="header" header-height="45mm" footer="myfooter" footer-height="10mm">';
			//This is the summary parts
			var classListSummary = summaryStructure.classlist;
			var openingBalSummary = summaryStructure.openingbalancelist;
			var incomeListSummary = summaryStructure.incomelist;
			var expenseListSummary = summaryStructure.expenselist;
			var transferListSummary = summaryStructure.transferlist;
			var surplusListSummary = summaryStructure.surpluslist;
			var closingBalanceListSummary = summaryStructure.closingbalancelist;
			var summaryIncomeList = projSummaryParam.incomeList;
			var summaryCogsList = projSummaryParam.cogsList;
			var summaryExpenseList = projSummaryParam.expenseList;
			var summaryNetLine = projSummaryParam.netLine;
			var summaryAllOpening = projSummaryParam.allopening;
			xml += '<p><b>Summary</b></p><br/>';
			xml += '<table width="100%" border="0" page-break-inside="avoid" break-inside= "avoid"><thead><tr>';

			xml += '<th colspan="2"></th>' + '<th align="center" colspan="2"><b>Actual</b></th>' + '<th align="center" colspan="2"><b>Budget</b></th>' + '<th align="center" colspan="2"><b>Variance</b></th>' + '<th width="7%"></th>';
			xml += '<th align="center" width="7%"><b>Annual financial budget</b></th>';
			xml += '<th align="center" width="7%"><b>Last 12 months</b></th>';
			xml += '</tr></thead><tbody>';
			xml += '<tr class="deepshadetop">' +
				'<th align="left" width="7%"></th>' +
				'<th align="left" width="7%"></th>' +
				'<th align="center" width="7%"><b>Period</b></th>' +
				'<th align="center" width="7%" class="deepshadevert"><b>Year to date</b></th>' +
				'<th align="center" width="7%"><b>Period</b></th>' +
				'<th align="center" width="7%" class="deepshadevert"><b>Year to date</b></th>' +
				'<th align="center" width="7%"><b>Period</b></th>' +
				'<th align="center" width="7%"><b>Year to date</b></th>' +
				'<th align="center" width="7%"></th>' +
				'<th align="right" width="7%" class="deepshadevert"></th>' +
				'<th align="left"></th>' +
				'</tr>';
			if (summaryIncomeList.length != 0) {
				xml += '<tr>' +
					'<th align="left" width="7%"><u>Income</u></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%" class="deepshadevert"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%" class="deepshadevert"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="center" width="7%"></th>' +
					'<th align="right" width="7%" class="deepshadevert"></th>' +
					'<th align="left"></th>' +
					'</tr>';
				for (var i = 0; i < summaryIncomeList.length; i++) {
					xml += '<tr>';
					var columnValList = summaryIncomeList[i];
					xml += '<th align="left" colspan="2">' + columnValList[0] + '</th>';
					for (var j = 1; j < columnValList.length; j++) {
						if ((j == 2) || (j == 4)) {
							xml += '<th align="right" class="deepshadevert" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else if (j == 9) {
							xml += '<th align="right" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else if (j == 8) {
							xml += '<th align="right" class="deepshadevert" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else {
							xml += '<th align="right" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						}

					}
					xml += '</tr>';
				}
			}
			if (summaryCogsList.length != 0) {
				xml += '<tr>' +
					'<th align="left" width="7%"><u>Purchases/Cost of Sales</u></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%" class="deepshadevert"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%" class="deepshadevert"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="center" width="7%"></th>' +
					'<th align="right" width="7%" class="deepshadevert"></th>' +
					'<th align="left"></th>' +
					'</tr>';
				for (var i = 0; i < summaryCogsList.length; i++) {
					xml += '<tr>';
					var columnValList = summaryCogsList[i];
					xml += '<th align="left" colspan="2">' + columnValList[0] + '</th>';
					for (var j = 1; j < columnValList.length; j++) {
						if ((j == 2) || (j == 4)) {
							xml += '<th align="right" class="deepshadevert" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else if (j == 9) {
							xml += '<th align="right" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else if (j == 8) {
							xml += '<th align="right" class="deepshadevert" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else {
							xml += '<th align="right" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						}
					}
					xml += '</tr>';
				}
			}
			if (summaryExpenseList.length != 0) {
				xml += '<tr>' +
					'<th align="left" width="7%"><u>Expenses</u></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%" class="deepshadevert"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%" class="deepshadevert"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="center" width="7%"></th>' +
					'<th align="right" width="7%" class="deepshadevert"></th>' +
					'<th align="left"></th>' +
					'</tr>';
				for (var i = 0; i < summaryExpenseList.length; i++) {
					xml += '<tr>';
					var columnValList = summaryExpenseList[i];
					xml += '<th align="left" colspan="2">' + columnValList[0] + '</th>';
					for (var j = 1; j < columnValList.length; j++) {
						if ((j == 2) || (j == 4)) {
							xml += '<th align="right" class="deepshadevert" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else if (j == 9) {
							xml += '<th align="right" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else if (j == 8) {
							xml += '<th align="right" class="deepshadevert" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						} else {
							xml += '<th align="right" style="padding-right: 2px;">' + columnValList[j] + '</th>';
						}
					}
					xml += '</tr>';
				}
			}
			xml += '<tr class="deepshadebot">' +
				'<th align="left" colspan="2">Net surplus/(deficit)</th>';
			for (var i = 0; i < summaryNetLine.length; i++) {
				if (i == 8) {
					xml += '<th align="right" style="padding-right: 2px;">' + summaryNetLine[i] + '</th>';
				} else if (i == 7) {
					xml += '<th align="right" style="padding-right: 2px;">' + summaryNetLine[i] + '</th>';
				} else {
					xml += '<th align="right" style="padding-right: 2px;">' + summaryNetLine[i] + '</th>';
				}

			}
			xml += '</tr>';
			xml += '</tbody></table><br/>';
			var toShowAdv = false;
			var advancesList = entireInputStructure.advances;
			var advancesOpening = entireInputStructure.advancesaccountopening;
			var linkAdvanceToBox = +advancesOpening;
			if (advancesList.length != 0) {
				var advancesAccountclosing = +advancesOpening;
				var creditAccum = 0.00;
				var debitAccum = 0.00;
				for (var u = 0; u < advancesList.length; u++) {
					//				   log.debug('advances account line', advancesList[u]);
					var currencyLine = advancesList[u].currency[0].text;
					var debitAmount = advancesList[u].debitamount;
					var creditAmount = advancesList[u].creditamount;
					var rawTranDateList = (advancesList[u].trandate).split('/');
					var lineExchangeRate = advancesList[u].exchangerate;
					var lineSubsidiary = advancesList[u].custcol_lc_subsidiary_line;
					//	    		   var plainAmount = makeItCurrency((advancesList[u].amount), currency);
					var plainAmount = (Math.abs(convertMyCurrency((advancesList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2);
					var postingPerRow = advancesList[u].postingperiod[0].text;
					var accountType = advancesList[u].account[0].value;
					var tranType = advancesList[u].accounttype;
					if ((((postingPerRow == postPer) && ((((debitAmount > 0) && (debitAmount != "")) || ((creditAmount > 0) && (creditAmount != "")))))) &&
						(((!lineSubsidiary) || (lineSubsidiary == "")) || (subsidiaryString == lineSubsidiary))) {
						toShowAdv = true;
						var tranIDText = advancesList[u].tranid;
						var accountFullText = (advancesList[u].account)[0].text;
						var accountTextSplit = accountFullText.split(' ');

						if ((debitAmount > 0) || (debitAmount != "")) {
							linkAdvanceToBox = (+linkAdvanceToBox - +plainAmount).toFixed(2);
							debitAccum += +plainAmount;
						} else {
							linkAdvanceToBox = (+linkAdvanceToBox + +plainAmount).toFixed(2);
							creditAccum += +plainAmount;
						}

					}


				}
			}
			//This is the analysis mini table
			var spoofOpening = +(deconvertNumber(summaryAllOpening));
			var closingSurplus = +spoofOpening + +(deconvertNumber(summaryNetLine[0]));
			var fundAvailable = +closingSurplus + +linkAdvanceToBox;
			xml += '<table width="30%" border="1" rules="none" frame="border" page-break-inside="avoid" break-inside= "avoid" align="center">';
			xml += '<tbody>';
			xml += '<tr>' +
				'<th align="left" style="padding-left: 10px;">  Opening surplus/(deficit)</th>' +
				'<th align="right" style="padding-right: 10px;">' + stringifyCurrency(spoofOpening) + ' </th>';
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left" style="padding-left: 10px;">  Net change</th>' +
				'<th align="right" class="deepshadebotsingle" style="padding-right: 10px;">' + summaryNetLine[0] + '   </th>';
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left" style="padding-left: 10px;">  Closing surplus/(deficit)</th>' +
				'<th align="right" class="deepshadehalf" style="padding-right: 10px;">' + stringifyCurrency(closingSurplus) + ' </th>';
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left"></th>' +
				'<th align="right"> </th>';
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left" style="padding-left: 10px;">  Outstanding advances</th>' +
				'<th align="right" class="deepshadebotsingle" style="padding-right: 10px;">' + stringifyCurrency(linkAdvanceToBox) + ' </th>';
			xml += '</tr>';
			xml += '<tr>' +
				'<th align="left" style="padding-left: 10px;">  Funds available for withdrawal</th>' +
				'<th align="right" class="deepshadehalf" style="padding-right: 10px;">' + stringifyCurrency(fundAvailable) + ' </th>';
			xml += '</tr>';
			xml += '</tbody></table><br/>';
			log.debug('view of advance list when render', advancesList);
			log.debug('length of advance list when render', advancesList.length);
			if ((advancesList.length != 0) && (toShowAdv == true)) {
				var advancesAccountclosing = +advancesOpening;
				var creditAccum = 0.00;
				var debitAccum = 0.00;
				xml += '<table width="100%" border="0" page-break-inside="avoid" break-inside= "avoid">';
				// xml += '<table width="100%" border="1" border-right="1" page-break-inside="avoid" break-inside= "avoid">';
				xml += '<thead><tr>';
				xml += '<th align="left" colspan="2">1520 Advance</th>' + '<th colspan="1" align="left"></th>' + '<th width="33%" align="left"></th>' + '<th colspan="2" align="left"></th>';
				xml += '<th align="left" width="7%"></th>';
				xml += '<th align="right" colspan="2">Opening balance</th>';
				xml += '<th align="right" width="7%">' + stringifyCurrency(advancesOpening) + '</th>';
				xml += '</tr></thead>';
				xml += '<tbody>';
				xml += '<tr class="deepshadetop">' +
					'<th align="left" width="10%"><b>Date</b></th>' +
					'<th align="left" width="14%"><b>Trans ID</b></th>' +
					'<th align="left" width="7%"><b>Account</b></th>' +
					'<th align="left" width="33%"><b>Memo</b></th>' +
					'<th align="left"></th>' + '<th align="left" width="7%"></th>' +
					'<th align="left"></th>' +
					'<th align="center" width="7%"><b>Advanced</b></th>' +
					'<th align="center" width="7%"><b>Repaid</b></th>' +
					'<th align="center" width="11%"><b>Balance</b></th>' +

					'</tr>';
				for (var u = 0; u < advancesList.length; u++) {
					//				   log.debug('advances account line', advancesList[u]);
					var currencyLine = advancesList[u].currency[0].text;
					var debitAmount = advancesList[u].debitamount;
					var creditAmount = advancesList[u].creditamount;
					var rawTranDateList = (advancesList[u].trandate).split('/');
					var lineExchangeRate = advancesList[u].exchangerate;
					var lineSubsidiary = advancesList[u].custcol_lc_subsidiary_line;
					//	    		   var plainAmount = makeItCurrency((advancesList[u].amount), currency);
					var plainAmount = (Math.abs(convertMyCurrency((advancesList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2);
					var postingPerRow = advancesList[u].postingperiod[0].text;
					var accountType = advancesList[u].account[0].value;
					var recType = advancesList[u].type[0].value;
					var tranType = advancesList[u].accounttype;
					if ((((postingPerRow == postPer) && ((((debitAmount > 0) && (debitAmount != "")) || ((creditAmount > 0) && (creditAmount != "")))))) &&
						(((!lineSubsidiary) || (lineSubsidiary == "")) || (subsidiaryString == lineSubsidiary))) {
						xml += '<tr>';
						xml += '<th align="left" width="10%">' + advancesList[u].trandate + '</th>';
						var tranIDText = advancesList[u].tranid;
						if (((!tranIDText) || (tranIDText == "")) || (recType == 'VPrep')) {
							xml += '<th align="left" width="14%">' + advancesList[u].transactionnumber + '</th>';
						} else {
							xml += '<th align="left" width="14%">' + advancesList[u].tranid + '</th>';
						}
						var accountFullText = (advancesList[u].account)[0].text;
						var accountTextSplit = accountFullText.split(' ');
						xml += '<th align="left" width="7%">' + accountTextSplit[0] + '</th>';
						xml += '<th align="left" width="33%">' + advancesList[u].memo + '</th>';
						xml += '<th align="left" width="7%"></th>';
						xml += '<th align="left" width="7%"></th>';
						xml += '<th align="left"></th>';
						var debitInstance = advancesList[u].debitamount;
						var creditInstance = advancesList[u].creditamount;
						if ((debitInstance) && (debitInstance > 0)) {
							xml += '<th align="right" width="7%">' + stringifyCurrency((Math.abs(convertMyCurrency((advancesList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
							xml += '<th align="right" width="7%"></th>';
						} else {
							xml += '<th align="right" width="7%"></th>';
							xml += '<th align="right" width="7%">' + stringifyCurrency((Math.abs(convertMyCurrency((advancesList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
						}
						// xml += '<th align="left"></th>';

						if ((debitAmount > 0) || (debitAmount != "")) {
							advancesAccountclosing = (+advancesAccountclosing - +plainAmount).toFixed(2);
							debitAccum += +plainAmount;
						} else {
							advancesAccountclosing = (+advancesAccountclosing + +plainAmount).toFixed(2);
							creditAccum += +plainAmount;
						}

						//	        		   log.debug('advancesAccountclosing', advancesAccountclosing);
						//	        		   xml += '<th align="right" width="10%">' + classAccumulation.toString() + '</th>';
						xml += '<th align="right" width="11%">' + stringifyCurrency((+advancesAccountclosing).toFixed(2).toString()) + '</th>';

						xml += '</tr>';

					}


				}
				xml += '<tr class="deepshadebot">' +
					'<th align="left" width="10%"><b>Total</b></th>' +
					'<th align="left" width="14%"></th>' +
					'<th align="left" width="7%"></th>' +
					'<th align="left" width="33%"></th>' +
					'<th align="left"></th>' +
					// '<th align="left" width="7%">' + stringifyCurrency(debitAccum.toFixed(2).toString()) + '</th>' +
					'<th align="right" width="7%"> </th>' +
					// '<th align="left" width="7%">' + stringifyCurrency(creditAccum.toFixed(2).toString()) + '</th>' + '<th align="left" width="7%">Closing balance</th>' +
					'<th align="right" width="7%"> </th>' + '<th align="right" colspan="2">Closing balance</th>' +
					'<th align="right" width="11%">' + stringifyCurrency((+advancesAccountclosing).toFixed(2).toString()) + '</th>' +

					'</tr>';
				xml += '</tbody></table><br/>';
			}
			xml += '<p style="page-break-before: always;"><b>Detailed Transactions</b></p>';
			xml += '<table width="100%" border="0" page-break-inside="auto" break-inside= "auto"><thead><tr>';
			// xml += '<table width="100%" border="1" border-right="1" page-break-inside="avoid" break-inside= "avoid"><thead><tr>';
			xml += '</tr></thead><tbody>';
			xml += '<tr class="deepshadetop">' +
				'<th align="left" width="10%"><b>Date</b></th>' +
				'<th align="left" width="14%"><b>Trans ID</b></th>' +
				'<th align="left" width="7%"><b>Account</b></th>' +
				'<th align="left" width="33%"><b>Memo</b></th>' +
				'<th align="left"></th>' +
				'<th align="left"></th>' +
				'<th align="center" width="7%"><b>Debit</b></th>' +
				'<th align="center" width="7%"><b>Credit</b></th>' +
				'<th align="center" width="11%"><b>Net Change</b></th>' +


				'</tr>';
			var classAccumulation = classOpeningBal;
			var creditAccum = 0.00;
			var debitAccum = 0.00;
			var sortedTranList = [];
			for (var w = 0; w < entireInputStructure.transactions.length; w++) {
				var listTransByClass = entireInputStructure.transactions[w];
				//	           log.debug('total number of trans rows', listTransByClass.length);
				var classOpeningBal = 100.00;
				if (listTransByClass.length != 0) {



					for (var u = 0; u < listTransByClass.length; u++) {
						var debitAmount = listTransByClass[u].values.debitamount;
						var creditAmount = listTransByClass[u].values.creditamount;
						var currencyLine = listTransByClass[u].values.currency[0].text;
						var debitAmount = listTransByClass[u].values.debitamount;
						var creditAmount = listTransByClass[u].values.creditamount;
						var rawTranDateList = (listTransByClass[u].values.trandate).split('/');
						// log.debug('raw tran date list', rawTranDateList);
						var sortTranDate = Date.parse(new Date(rawTranDateList[1] + '/' + rawTranDateList[0] + '/' + rawTranDateList[2]));
						// log.debug('sorted Tran Date value', sortTranDate);
						var object2Push = listTransByClass[u].values;
						object2Push.sorttrandate = +sortTranDate;
						sortedTranList.push(object2Push);

					}


				}
			}
			sortedTranList.sort(compareTranDate);
			for (var u = 0; u < sortedTranList.length; u++) {
				var debitAmount = sortedTranList[u].debitamount;
				var creditAmount = sortedTranList[u].creditamount;
				var currencyLine = sortedTranList[u].currency[0].text;
				var debitAmount = sortedTranList[u].debitamount;
				var creditAmount = sortedTranList[u].creditamount;
				var rawTranDateList = (sortedTranList[u].trandate).split('/');

				var lineExchangeRate = sortedTranList[u].exchangerate;
				var lineSubsidiary = sortedTranList[u].custcol_lc_subsidiary_line;
				var plainAmount = (Math.abs(convertMyCurrency((sortedTranList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2);
				var postingPerRow = sortedTranList[u].postingperiod[0].text;
				var accountTypePerRow = sortedTranList[u].accounttype;
				var accountType = sortedTranList[u].account[0].value;
				var recType = sortedTranList[u].type[0].value;
				var tranType = sortedTranList[u].accounttype;
				//	        		   log.debug('transaction record view by row', listTransByClass[u]);
				if (((((postingPerRow == postPer) && ((((debitAmount > 0) && (debitAmount != "")) || ((creditAmount > 0) && (creditAmount != "")))))) &&
					(((!lineSubsidiary) || (lineSubsidiary == "")) || (subsidiaryString == lineSubsidiary))) && ((tranType == 'Income') || (tranType == 'Expense') || (tranType == 'Other Expense') || (tranType == 'Cost of Goods Sold'))) {

					//	        		   if (((debitAmount > 0) && (debitAmount != "")) || ((creditAmount > 0) && (creditAmount != ""))) {
					xml += '<tr>';
					xml += '<th align="left" width="10%">' + sortedTranList[u].trandate + '</th>';
					if ((!(sortedTranList[u].tranid) || ((sortedTranList[u].tranid) == "")) || (recType == 'VPrep')) {
						xml += '<th align="left" width="14%">' + sortedTranList[u].transactionnumber + '</th>';
					} else {
						xml += '<th align="left" width="14%">' + sortedTranList[u].tranid + '</th>';
					}

					var accountFullText = (sortedTranList[u].account)[0].text;
					var accountTextSplit = accountFullText.split(' ');
					xml += '<th align="left" width="7%">' + accountTextSplit[0] + '</th>';
					xml += '<th align="left" width="33%">' + sortedTranList[u].memo + '</th>';
					xml += '<th align="left" width="7%"></th>';
					xml += '<th align="left"></th>';
					var debitInstance = sortedTranList[u].debitamount;
					var creditInstance = sortedTranList[u].creditamount;
					if ((debitInstance) && (debitInstance > 0)) {
						xml += '<th align="right" width="7%">' + stringifyCurrency((Math.abs(convertMyCurrency((sortedTranList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
						xml += '<th align="right" width="7%"></th>';
					} else {
						xml += '<th align="right" width="7%"></th>';
						xml += '<th align="right" width="7%">' + stringifyCurrency((Math.abs(convertMyCurrency((sortedTranList[u].fxamount), currencyLine, currencySub, lineExchangeRate))).toFixed(2)) + '</th>';
					}


					if ((debitAmount > 0) || (debitAmount != "")) {
						classAccumulation = +classAccumulation + plainAmount;
						debitAccum += +plainAmount;
					} else {
						classAccumulation = +classAccumulation - +plainAmount;
						creditAccum += +plainAmount;
					}
					xml += '<th align="right" width="11%"></th>';
					xml += '</tr>';

				}

			}
			xml += '<tr class="deepshadebot">' +
				'<th align="left" width="10%"><b>Total</b></th>' +
				'<th align="left" width="14%"></th>' +
				'<th align="left" width="7%"></th>' +
				'<th align="left" width="33%"></th>' +
				'<th align="left"></th>' +
				'<th align="left"></th>' +
				'<th align="right" width="7%">' + stringifyCurrency(debitAccum.toFixed(2).toString()) + '</th>' +
				'<th align="right" width="7%">' + stringifyCurrency(creditAccum.toFixed(2).toString()) + '</th>' +
				'<th align="right" width="11%">' + stringifyCurrency((+creditAccum - +debitAccum).toFixed(2).toString()) + '</th>' +


				// '<th align="left" width="7%"></th>' +
				'</tr>';
			xml += '</tbody></table><br/>';
			xml += '</body></pdf>';
			return xml;
		}

		function getAllResults(s, cumulativeSearch) {
			var results = s.run();
			var searchResults = cumulativeSearch;
			var searchid = 0;
			do {
				var resultslice = results.getRange({ start: searchid, end: searchid + 1000 });
				resultslice.forEach(function (slice) {
					searchResults.push(slice);
					searchid++;
				}
				);
			} while (resultslice.length >= 1000);
			return searchResults;
		}

		function getInputData() {
			var scriptObj = runtime.getCurrentScript();
			var scriptId = scriptObj.id;
			var deploymentId = scriptObj.deploymentId;
			var myEnvType = runtime.envType;
			if (myEnvType == "SANDBOX") {
				var exclusionList = ['', '8'];
				var noneOfList = [377, 962];
			} else {
				var exclusionList = ['', '13'];
				var noneOfList = [786, 1381];
			}
			var reportType = scriptObj.getParameter({ name: 'custscript_ps_report_type' });
			var triggerEmail = scriptObj.getParameter({ name: 'custscript_ps_sendemail' });
			log.debug('report type input', reportType);
			var depositFolder = scriptObj.getParameter({ name: 'custscript_ps_folder_deposit' });
			var postingPeriodInput = scriptObj.getParameter({ name: 'custscript_ps_postingperiod' });
			var workerList = JSON.parse(scriptObj.getParameter({ name: 'custscript_ps_workerlist' }));

			var projectList = JSON.parse(scriptObj.getParameter({ name: 'custscript_ps_projectlist' }));
			log.debug('project list input', projectList);
			log.debug('project list length', projectList.length);
			var trackerID = scriptObj.getParameter({ name: 'custscript_ps_trackerparent' });
			var printedfor = scriptObj.getParameter({ name: 'custscript_ps_printedfor' });
			log.debug('subsidiary input stage', printedfor);
			var total = 0;
			var jsonParamStage1 = {};//Initialize json input data, empty.


			//Raw initial saved search
			if (reportType == 'worker') {
				var massSearch = search.create({
					type: 'transaction',
					columns: [
						{ name: 'tranid' },
						{ name: 'internalid' },
						{ name: 'postingperiod' },
						{ name: 'memo' },
						{ name: 'trandate' },
						{ name: 'account' },
						{ name: 'terms' },
						{ name: 'currency' },
						{ name: 'amount' },
						{ name: 'class' },
						{ name: 'transactionnumber' },
						{ name: 'type' },
						{ name: 'line.cseg_lc_worker' },
						{ name: 'line.cseg_lc_project' },
						{ name: 'custcol_lc_subsidiary_line' },
						{ name: 'location' },
						{ name: 'subsidiary' },
						{ name: 'department' },
						{ name: 'debitamount' },
						{ name: 'creditamount' },
						{ name: 'accounttype' },
						{ name: 'fxamount' },
						{ name: 'exchangerate' }
					],
					filters: [
						['posting', 'is', 'T'],
						'and', ['line.cseg_lc_worker', 'anyof', workerList],
						'and', ['amount', 'NOTEQUALTO', '0.00'],
						'and', ['class', 'NONEOF', exclusionList],
						'and', ['account', 'NONEOF', noneOfList]
					]
				});

				var balanceSheetSearch = search.create({
					//    			var massSearch = search.create({
					type: 'transaction',
					columns: [
						{ name: 'tranid' },
						{ name: 'internalid' },
						{ name: 'postingperiod' },
						{ name: 'memo' },
						{ name: 'trandate' },
						{ name: 'account' },
						{ name: 'terms' },
						{ name: 'currency' },
						{ name: 'amount' },
						{ name: 'class' },
						{ name: 'transactionnumber' },
						{ name: 'type' },
						{ name: 'line.cseg_lc_worker' },
						{ name: 'line.cseg_lc_project' },
						{ name: 'location' },
						{ name: 'subsidiary' },
						{ name: 'department' },
						{ name: 'debitamount' },
						{ name: 'creditamount' },
						{ name: 'accounttype' },
						{ name: 'fxamount' },
						{ name: 'exchangerate' },
						{ name: 'mainline' },
						{ name: 'billable' },
						//        	             {name: 'cogs'},
						{ name: 'taxline' }

					],
					filters: [
						['posting', 'is', 'T'],
						'and', ['line.cseg_lc_worker', 'anyof', workerList],
						'and', ['amount', 'NOTEQUALTO', '0.00'],
						'and', ['account', 'anyof', noneOfList]
					]
				});
				var initialList = [];
				//        		var rawresults = getAllResults(massSearch, initialList);
				var rawresultTemp = getAllResults(massSearch, initialList);
				var rawresults = getAllResults(balanceSheetSearch, rawresultTemp);
			} else {
				var massSearch = search.create({
					type: 'transaction',
					columns: [
						{ name: 'tranid' },
						{ name: 'internalid' },
						{ name: 'postingperiod' },
						{ name: 'memo' },
						{ name: 'trandate' },
						{ name: 'account' },
						{ name: 'terms' },
						{ name: 'currency' },
						{ name: 'amount' },
						{ name: 'class' },
						{ name: 'transactionnumber' },
						{ name: 'type' },
						{ name: 'line.cseg_lc_worker' },
						{ name: 'line.cseg_lc_project' },
						{ name: 'custcol_lc_subsidiary_line' },
						{ name: 'location' },
						{ name: 'subsidiary' },
						{ name: 'department' },
						{ name: 'debitamount' },
						{ name: 'creditamount' },
						{ name: 'accounttype' },
						{ name: 'fxamount' },
						{ name: 'exchangerate' }
					],
					filters: [
						['posting', 'is', 'T'],
						'and', ['line.cseg_lc_project', 'anyof', projectList],
						'and', ['amount', 'NOTEQUALTO', '0.00']
					]
				});
				var initialList = [];
				var rawresults = getAllResults(massSearch, initialList);
			}

			//        log.debug('length of raw result', rawresults.length);
			// var newFile = file.create({
			// 	name: 'testdata',
			// 	//    		contents: JSON.stringify(rawresults),
			// 	folder: 539,
			// 	fileType: 'CSV',
			// });
			// for (var i = 0; i < rawresults.length; i++) {
			// 	newFile.appendLine({
			// 		value: JSON.stringify(rawresults[i])
			// 	});
			// }
			// newFile.save();
			return rawresults;

		}

		/**
		 * Executes when the map entry point is triggered and applies to each key/value pair.
		 *
		 * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
		 * @since 2015.1
		 */
		function map(context) {
			var scriptObj = runtime.getCurrentScript();
			var scriptId = scriptObj.id;
			var deploymentId = scriptObj.deploymentId;
			var reportType = scriptObj.getParameter({ name: 'custscript_ps_report_type' });
			var depositFolder = scriptObj.getParameter({ name: 'custscript_ps_folder_deposit' });
			var triggerEmail = scriptObj.getParameter({ name: 'custscript_ps_sendemail' });
			var postingPeriodInput = scriptObj.getParameter({ name: 'custscript_ps_postingperiod' });
			var workerList = JSON.parse(scriptObj.getParameter({ name: 'custscript_ps_workerlist' }));
			var projectList = JSON.parse(scriptObj.getParameter({ name: 'custscript_ps_projectlist' }));
			var transactionRow = JSON.parse(context.value);
			var trackerID = scriptObj.getParameter({ name: 'custscript_ps_trackerparent' });
			//    	log.debug('transaction row full view', transactionRow);

			var total = 0;
			var jsonParamStage2 = {};//Initialize json input data, empty.
			var matchFound = false;
			if (reportType == 'worker') {
				for (var g = 0; g < workerList.length; g++) {
					//    			log.debug('child worker id to update tracker', workerList[g]);
					//    			searchAndUpdateChildTrackers(trackerID, workerList[g], 'In Progress');
					var workerValue = (transactionRow.values['line.cseg_lc_worker'])[0].value;
					//    			log.debug('worker object in row', (transactionRow.values['line.cseg_lc_worker'])[0].value);
					if (workerList[g] == workerValue) {
						matchFound = true;
						var keyMap1 = workerValue;
						log.debug('class value', transactionRow.values['class']);
						if (transactionRow.values['class'][0] != "") {
							var keyMap2 = (transactionRow.values['class'])[0].value;
						} else {
							var keyMap2 = "NA";
						}
					}
				}
			} else {
				for (var g = 0; g < projectList.length; g++) {
					//    			searchAndUpdateChildTrackers(trackerID, projectList[g], 'In Progress');
					var projectValue = (transactionRow.values['line.cseg_lc_project'])[0].value;
					// log.debug('project object in row', (transactionRow.values['line.cseg_lc_project'])[0].value);
					if (projectList[g] == projectValue) {
						matchFound = true;
						var keyMap1 = projectValue;
						var keyMap2 = (transactionRow.values['account'])[0].value;
					}
				}
			}
			var keyMapCombine = keyMap1 + "|" + keyMap2;
			if (matchFound == true) {
				context.write({
					key: keyMapCombine,
					value: transactionRow
				});
				//    		log.debug('key written in map', keyMapCombine);
				//    		log.debug('value written in map', transactionRow);
			} else {
				return;
			}


		}

		/**
		 * Executes when the reduce entry point is triggered and applies to each group.
		 *
		 * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
		 * @since 2015.1
		 */
		function reduce(context) {
			var scriptObj = runtime.getCurrentScript();
			var scriptId = scriptObj.id;
			var deploymentId = scriptObj.deploymentId;
			var reportType = scriptObj.getParameter({ name: 'custscript_ps_report_type' });
			var depositFolder = scriptObj.getParameter({ name: 'custscript_ps_folder_deposit' });
			var triggerEmail = scriptObj.getParameter({ name: 'custscript_ps_sendemail' });
			var postingPeriodInput = scriptObj.getParameter({ name: 'custscript_ps_postingperiod' });
			var workerList = JSON.parse(scriptObj.getParameter({ name: 'custscript_ps_workerlist' }));
			var projectList = JSON.parse(scriptObj.getParameter({ name: 'custscript_ps_projectlist' }));
			var trackerID = scriptObj.getParameter({ name: 'custscript_ps_trackerparent' });

			var reduceInput = [];
			var reduceValue = {};
			var reducelist = context.values;
			for (var k in reducelist) {
				var jsonReduce = JSON.parse(reducelist[k]);
				reduceInput.push(jsonReduce);
			}
			var mapkey = context.key;
			var mapkeySplit = mapkey.split("|");
			var keyReduce1 = mapkeySplit[0];
			// log.debug('reduce input key text', keyReduce1);
			// log.debug('reduce input values', reduceInput);

			context.write({
				key: keyReduce1,
				value: reduceInput
			});

		}


		/**
		 * Executes when the summarize entry point is triggered and applies to the result set.
		 *
		 * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
		 * @since 2015.1
		 */
		function summarize(summary) {
			if (summary.inputSummary.error) {
				log.error({
					title: 'Input Error',
					details: summary.inputSummary.error
				})
			};
			summary.mapSummary.errors.iterator().each(function (key, error, executionNo) {
				log.error({
					title: 'Map error for key: ' + key + ', execution no.  ' + executionNo,
					details: error
				});
				return true;
			});
			summary.reduceSummary.errors.iterator().each(function (key, error, executionNo) {
				log.error({
					title: 'Reduce error for key: ' + key + ', execution no. ' + executionNo,
					details: error
				});
				return true;
			});


			var scriptObj = runtime.getCurrentScript();
			var scriptId = scriptObj.id;
			var deploymentId = scriptObj.deploymentId;
			var reportType = scriptObj.getParameter({ name: 'custscript_ps_report_type' });
			var printedBy = scriptObj.getParameter({ name: 'custscript_ps_printedby' });
			var printedById = scriptObj.getParameter({ name: 'custscript_ps_printedbyid' });
			log.debug('input printed by id', printedById);
			var myEnvType = runtime.envType;
			if (myEnvType == "SANDBOX") {
				var exclusionList = ['', '8'];
				var noneOfList = [377, 962];
				var accountPersonalNumber = '377';
				var accountFringeNumber = '962';
				var interfundNumber = '670';
				var fundBal3000Number = '263';
				var advanceAccNumber = '118';
			} else {
				var exclusionList = ['', '13'];
				var noneOfList = [786, 1381];
				var accountPersonalNumber = '786';
				var accountFringeNumber = '1381';
				var interfundNumber = '1010';
				var fundBal3000Number = '795';
				var advanceAccNumber = '118';
			}
			var printedfor = scriptObj.getParameter({ name: 'custscript_ps_printedfor' });
			//    	log.debug('subsidiary summary', printedfor);
			var trackerID = scriptObj.getParameter({ name: 'custscript_ps_trackerparent' });
			var subsidSearch = search.create({
				type: 'subsidiary',
				columns: [
					'name',
					'internalid',
					'namenohierarchy',
					'currency',
					'custrecord_lc_ps_folder'
				],
				filters: [
					['internalid', 'is', printedfor]
				]
			});

			var subsidResults = subsidSearch.run().getRange({
				start: 0,
				end: 10
			});
			var subsidString = subsidResults[0].getValue({ name: 'namenohierarchy' });
			var subsidCurr = subsidResults[0].getText({ name: 'currency' });
			var subsidiaryTimeZone = getSubsidiaryTimezone(printedfor);
			if (reportType == 'worker') {
				var reportTypeString = 'Worker';
			} else {
				var reportTypeString = 'Project';
			}
			var depositFolder = subsidResults[0].getValue({ name: 'custrecord_lc_ps_folder' });

			if (reportType == 'worker') {
				var folderExist = search.create({
					type: 'folder',
					filters: [
						['name', 'contains', 'Worker'],
						'and',
						['parent', 'anyof', [depositFolder]]
					]
				}).run().getRange({ start: 0, end: 1 });
				var pdfFolderLoc = folderExist[0].id;
			} else {
				var folderExist = search.create({
					type: 'folder',
					filters: [
						['name', 'contains', 'Project'],
						'and',
						['parent', 'anyof', [depositFolder]]
					]
				}).run().getRange({ start: 0, end: 1 });
				var pdfFolderLoc = folderExist[0].id;
			}
			var todayNoTMZ = new Date();
			var seconds = todayNoTMZ.getSeconds();
			var milisecond = todayNoTMZ.getMilliseconds();
			var todayTemp = format.parse({
				value: todayNoTMZ,
				type: format.Type.DATETIME,
				timezone: format.Timezone.GMT
			});
			var todayTemp2 = format.format({
				value: todayTemp,
				type: format.Type.DATETIME,
				timezone: subsidiaryTimeZone
			});
			//	     log.debug('converted timezone 1', todayTemp2);
			//	     log.debug(typeof todayTemp2);
			var todayTemp2List = todayTemp2.split(' ');
			var ampm = todayTemp2List[todayTemp2List.length - 1];
			var today = format.parse({
				value: todayTemp2,
				type: format.Type.DATE
			});
			var date = today.getDate() + ' ' + formatDateAustralia(today) + ', ';
			if (ampm.indexOf('pm') != 0) {
				var hourVal = ('0' + today.getHours()).slice(-2);
			} else {
				var hourVal = (+(('0' + today.getHours()).slice(-2)) + 12).toString();
			}

			var time = (hourVal + ":" + ('0' + today.getMinutes()).slice(-2) + ":" + ('0' + today.getSeconds()).slice(-2));
			var combinedDate = "Printed By " + printedBy + "-" + date + " " + time + seconds.toString() + milisecond.toString();
			var titleAppend = "Printed By " + printedBy + ", " + date + " " + time + seconds.toString() + milisecond.toString();
			var subFolder = record.create({
				type: record.Type.FOLDER,
				isDynamic: true
			});
			subFolder.setValue({
				fieldId: 'name',
				value: combinedDate
			});
			subFolder.setValue({
				fieldId: 'parent',
				value: pdfFolderLoc
			});
			var subfolderID = subFolder.save({
				enableSourcing: true,
				ignoreMandatoryFields: true
			});
			// log.debug('subfolder id', subfolderID);
			var postingPeriodInput = scriptObj.getParameter({ name: 'custscript_ps_postingperiod' });
			//    	log.debug('posting period summary', postingPeriodInput);
			var triggerEmail = scriptObj.getParameter({ name: 'custscript_ps_sendemail' });
			var workerList = JSON.parse(scriptObj.getParameter({ name: 'custscript_ps_workerlist' }));
			var projectList = JSON.parse(scriptObj.getParameter({ name: 'custscript_ps_projectlist' }));
			//    	log.debug('project list summary', projectList);
			var timeStamp = scriptObj.getParameter({ name: 'custscript_ps_timestamp' });
			//    	log.debug('time stamp summary', timeStamp);

			var subsidPrefix = subsidResults[0].getValue({ name: 'tranprefix' });
			if ((!subsidPrefix) || (subsidPrefix == "")) { subsidPrefix = subsidString }

			//    	log.debug('printed by summary', printedBy);

			if (reportType == 'worker') {
				var loopList = workerList;
			} else {
				var loopList = projectList;
			}
			var counter = 1;
			for (var q = 0; q < loopList.length; q++) {
				counter++;
				var jsonParam = {};
				var listAdmin = [];
				var listSupport = [];
				var listMinistry = [];
				var listProjectAll = [];
				var currentPDFInstance = loopList[q];
				var codeToUse = getProjectWorkerCode(currentPDFInstance, reportType);
				var pdfInstanceData = [];
				var listPersonalAccount = [];
				var listFringeBenefit = [];
				var listAdvances = [];
				var listProjOpeningsPast = [];

				summary.output.iterator().each(function (key, value) {
					log.debug('key value in iterate', key);
					log.debug('currentPDFInstance in iterate', currentPDFInstance);

					var transactionrow = JSON.parse(value);
					if (key == currentPDFInstance) {
						pdfInstanceData.push(transactionrow);

					}
					if (pdfInstanceData.length == 0) {
						return true;
					}

					for (var w = 0; w < pdfInstanceData.length; w++) {
						var listClassData = pdfInstanceData[w];
						// 	           log.debug('total number of trans rows', listClassData.length);
						for (var y = 0; y < listClassData.length; y++) {
							if (reportType == 'worker') {
								var classValue = listClassData[y].values.class[0].text;
								var accountValue = listClassData[y].values.account[0].value;
								if (classValue == 'Support') {
									listSupport.push(listClassData[y].values);
								} else if (classValue == 'Ministry') {
									listMinistry.push(listClassData[y].values);
								} else if (classValue == 'Personal') {
									listAdmin.push(listClassData[y].values);
								}
							} else {
								listProjectAll.push(listClassData[y].values);
							}

						}
					}

					return true;
				});
				var summaryParam = {};
				var budgetParam = {};
				var summaryProjParam = {};
				// var filterFile = file.create({
				// 	name: 'pdfInstanceData',
				// 	folder: subfolderID,
				// 	fileType: 'CSV',
				// });
				// for (var b = 0; b < pdfInstanceData.length; b++) {
				// 	filterFile.appendLine({
				// 		value: JSON.stringify(pdfInstanceData[b])
				// 	});
				// }
				// filterFile.save();


				if (pdfInstanceData.length != 0) {
					var existSupport = false;
					var existLines = false;
					var existBudget = true;
					var classList = [];
					var classNameList = [];
					var openingBalanceList = [];
					var incomeList = [];
					var expenseList = [];
					var transferList = [];
					var surplusList = [];
					var closingBalanceList = [];
					var budget1line = [];
					var budget2line = [];
					var budget3line = [];
					var projectIncomeList = [];
					var projectPurchaseList = [];
					var projectExpenseList = [];


					//    			log.debug('loop length to generate summary', pdfInstanceData.length);
					if (reportType == 'worker') {
						for (var z = 0; z < pdfInstanceData.length; z++) {
							var classID = pdfInstanceData[z][0].values.class[0].value;
							if ((classID) || (classID != 8) || (classID != "")) {
								var classNameSearch = search.create({
									type: 'classification',
									columns: [
										'name',
										'internalid',
										'namenohierarchy'
									],
									filters: [
										['internalid', 'is', classID]
									]
								});

								var classNameResults = classNameSearch.run().getRange({
									start: 0,
									end: 10
								});
								var className = classNameResults[0].getValue({ name: 'namenohierarchy' });
								//    		    	log.debug('class name no hierarchy values', className);

								//loop accumulation
								var toInclude = false;
								var incomeAccum = 0.00;
								var expenseAccum = 0.00;
								var transferAccum = 0.00;
								var netSurplus = 0.00;
								var openingBalAccum = 0.00;
								var closingBalAccum = 0.00;
								var supportIncomeYearToDate = 0.00;
								var supportIncome12Month = 0.00;
								for (var v = 0; v < pdfInstanceData[z].length; v++) {
									var lineSubsidiary = pdfInstanceData[z][v].values.custcol_lc_subsidiary_line;
									var mainSubsidiaryID = pdfInstanceData[z][v].values.subsidiary[0].value;
									if ((((!lineSubsidiary) || (lineSubsidiary == "")) && (printedfor == mainSubsidiaryID)) || (subsidString == lineSubsidiary)) {
										var currType = pdfInstanceData[z][v].values.currency[0].text;
										var tranType = pdfInstanceData[z][v].values.accounttype;
										var exchangeRate = pdfInstanceData[z][v].values.exchangerate;
										var accountType = pdfInstanceData[z][v].values.account[0].value;
										var postingPerSummary = pdfInstanceData[z][v].values.postingperiod[0].text;
										var parse1 = Date.parse('01 ' + postingPerSummary);
										var parse2 = Date.parse('01 ' + postingPeriodInput);
										if (accountType == accountPersonalNumber) {
											listPersonalAccount.push(pdfInstanceData[z][v].values);
										}
										if (accountType == accountFringeNumber) {
											listFringeBenefit.push(pdfInstanceData[z][v].values);
										}
										if (postingPerSummary == postingPeriodInput) {
											existLines = true;
											if (((tranType == 'Expense') && (accountType != interfundNumber)) || ((tranType == 'Other Expense') && (accountType != interfundNumber))) {
												toInclude = true;
												var debitOpen = pdfInstanceData[z][v].values.debitamount;
												if ((debitOpen) && (debitOpen > 0)) {
													expenseAccum = +expenseAccum - Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
												} else {
													expenseAccum = +expenseAccum + Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
												}

												//								}

											} else if (tranType == 'Income') {
												var debitOpen = pdfInstanceData[z][v].values.debitamount;
												if ((debitOpen) && (debitOpen > 0)) {
													//    								log.debug('line currency', currType);
													//    								log.debug('subsidiary currency', subsidCurr);
													//    								log.debug('amount to convert', pdfInstanceData[z][v].values.fxamount);
													incomeAccum = +incomeAccum - Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
												} else {
													incomeAccum = +incomeAccum + Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
												}

												//    							}

												toInclude = true;
											} else if (accountType == interfundNumber) {
												var debitOpen = pdfInstanceData[z][v].values.debitamount;
												if ((debitOpen) && (debitOpen > 0)) {
													transferAccum = +transferAccum - Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
												} else {
													transferAccum = +transferAccum + Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
												}

												//    							}

												toInclude = true;
											}
										}
										if (((((tranType == 'Expense') && (accountType != interfundNumber) && (accountType != accountPersonalNumber) && (accountType != accountFringeNumber))
											|| ((tranType == 'Other Expense') && (accountType != interfundNumber) && (accountType != accountPersonalNumber) && (accountType != accountFringeNumber))
											|| (tranType == 'Income') || (accountType == interfundNumber) && (accountType != accountPersonalNumber) && (accountType != accountFringeNumber)))
											|| (accountType == fundBal3000Number)) {
											var openingdate1 = new Date(parse1);
											var openingdate2 = new Date(parse2);
											openingdate2.setMonth(openingdate2.getMonth() + 1);
											var openingparseInclusion = Date.parse(openingdate2);
											if ((parse1 < parse2) || ((parse1 < openingparseInclusion) && (accountType == fundBal3000Number))) {
												var debitOpen = pdfInstanceData[z][v].values.debitamount;
												if ((debitOpen) && (debitOpen > 0)) {
													openingBalAccum = +openingBalAccum - Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
												} else {
													openingBalAccum = +openingBalAccum + Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
												}
												toInclude = true;
												//								log.debug('opening balance accumulation', openingBalAccum);
											}

											if ((tranType == 'Income') && (className == 'Support') && (accountType != accountPersonalNumber) && (accountType != accountFringeNumber)) {
												// existLines = true;
												var date1 = new Date(parse1);
												var date2 = new Date(parse2);
												date2.setMonth(date2.getMonth() + 1);
												var parseInclusion = Date.parse(date2);
												date2.setMonth(date2.getMonth() - 12);
												var parse12Month = Date.parse(date2);
												if ((postingPeriodInput.indexOf('Oct') == -1) && (postingPeriodInput.indexOf('Nov') == -1) && (postingPeriodInput.indexOf('Dec') == -1)) {
													var ytdList = postingPeriodInput.split(' ');
													var ytd = +ytdList[ytdList.length - 1] - 1;
													var fullytd = '01 Oct ' + ytd.toString();
												} else {
													var ytdList = postingPeriodInput.split(' ');
													var ytd = +ytdList[ytdList.length - 1];
													var fullytd = '01 Oct ' + ytd.toString();
												}
												var parse3 = Date.parse(fullytd);
												//								log.debug('parse 3 value', parse3);
												//								log.debug('parse 1 value', parse1);
												//								log.debug('parseInclusion value', parseInclusion);
												if ((parse3 <= parse1) && (parse1 < parseInclusion)) {
													//									if (currType != subsidCurr) {
													//										supportIncomeYearToDate = +supportIncomeYearToDate +  +makeItCurrency((pdfInstanceData[z][v].values.amount), subsidCurr);
													//									} else {
													//										supportIncomeYearToDate = +supportIncomeYearToDate +  +(pdfInstanceData[z][v].values.amount);
													var debitOpen = pdfInstanceData[z][v].values.debitamount;
													if ((debitOpen) && (debitOpen > 0)) {
														supportIncomeYearToDate = +supportIncomeYearToDate - Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
														supportIncome12Month = +supportIncome12Month - Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
													} else {
														supportIncomeYearToDate = +supportIncomeYearToDate + Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
														supportIncome12Month = +supportIncome12Month + Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
													}
													//									log.debug('support income year to date progress', supportIncomeYearToDate);

													//									}

												} else if ((parse12Month <= parse1) && (parse1 < parseInclusion)) {
													//									if (currType != subsidCurr) {
													//										supportIncome12Month = +supportIncome12Month +  +((pdfInstanceData[z][v].values.amount), subsidCurr);
													//									} else {
													//										supportIncome12Month = +supportIncome12Month +  +(pdfInstanceData[z][v].values.amount);
													var debitOpen = pdfInstanceData[z][v].values.debitamount;
													if ((debitOpen) && (debitOpen > 0)) {
														supportIncome12Month = +supportIncome12Month - Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
													} else {
														supportIncome12Month = +supportIncome12Month + Math.abs(+(convertMyCurrency((pdfInstanceData[z][v].values.fxamount), currType, subsidCurr, exchangeRate)));
													}

													//									}

												}
												//								supportIncome12Month = +incomeAccum +supportIncome12Month ;
												//								supportIncomeYearToDate = +incomeAccum +supportIncomeYearToDate ;
											}
										}

									}

								}
								if ((openingBalAccum != 0) && (openingBalAccum != 0.00) && (openingBalAccum != '(0.00)')) {
									existLines = true;
								}
								var personalAccountOpening = 0.00;
								if (listPersonalAccount.length != 0) {
									for (var i = 0; i < listPersonalAccount.length; i++) {
										var postingPerSummary = listPersonalAccount[i].postingperiod[0].text;
										var parse1 = Date.parse('01 ' + postingPerSummary);
										var parse2 = Date.parse('01 ' + postingPeriodInput);
										if (parse1 < parse2) {
											// existLines = true;
											var debitOpen = listPersonalAccount[i].debitamount;
											var currType = listPersonalAccount[i].currency[0].text;
											var tranType = listPersonalAccount[i].accounttype;
											var exchangeRate = listPersonalAccount[i].exchangerate;
											if ((debitOpen) && (debitOpen > 0)) {
												personalAccountOpening = +personalAccountOpening - Math.abs(+(convertMyCurrency((listPersonalAccount[i].fxamount), currType, subsidCurr, exchangeRate)));
											} else {
												personalAccountOpening = +personalAccountOpening + Math.abs(+(convertMyCurrency((listPersonalAccount[i].fxamount), currType, subsidCurr, exchangeRate)));
											}
										}
										// if (postingPerSummary == postingPeriodInput) {
										// 	// existLines = true;
										// }
									}
									if ((((+personalAccountOpening).toFixed(2)) != 0) && (((+personalAccountOpening).toFixed(2)) != 0.00) && (((+personalAccountOpening).toFixed(2)) != '(0.00)')) {
										log.debug('trigger print line 2844', (+personalAccountOpening).toFixed(2));
										existLines = true;
									}
								}
								var fringeBenefitOpening = 0.00;
								if (listFringeBenefit.length != 0) {


									for (var i = 0; i < listFringeBenefit.length; i++) {
										var postingPerSummary = listFringeBenefit[i].postingperiod[0].text;
										var parse1 = Date.parse('01 ' + postingPerSummary);
										var parse2 = Date.parse('01 ' + postingPeriodInput);
										if (parse1 < parse2) {

											var debitOpen = listFringeBenefit[i].debitamount;
											var currType = listFringeBenefit[i].currency[0].text;
											var tranType = listFringeBenefit[i].accounttype;
											var exchangeRate = listFringeBenefit[i].exchangerate;
											if ((debitOpen) && (debitOpen > 0)) {
												fringeBenefitOpening = +fringeBenefitOpening - Math.abs(+(convertMyCurrency((listFringeBenefit[i].fxamount), currType, subsidCurr, exchangeRate)));
											} else {
												fringeBenefitOpening = +fringeBenefitOpening + Math.abs(+(convertMyCurrency((listFringeBenefit[i].fxamount), currType, subsidCurr, exchangeRate)));
											}
										}
										// if (postingPerSummary == postingPeriodInput) {
										// 	// existLines = true;
										// }
									}
									if ((((+fringeBenefitOpening).toFixed(2)) != 0) && (((+fringeBenefitOpening).toFixed(2)) != 0.00) && (((+fringeBenefitOpening).toFixed(2)) != '(0.00)')) {
										log.debug('trigger print 2873', (+fringeBenefitOpening).toFixed(2));
										existLines = true;
									}
								}
								netSurplus = +incomeAccum + +expenseAccum + +transferAccum;
								closingBalAccum = +openingBalAccum + +netSurplus;
								//    				log.debug('class to remove NA', '/' + className + '/');
								if (className == 'Not Applicable') {
									toInclude = false;
									//    					log.debug('removed NA class');
								} else {
									//    					log.debug('still never removed NA Class');
								}
								if (toInclude == true) {
									classNameList.push(className);
									classList.push(pdfInstanceData[z][0].values.class[0].text);
									openingBalanceList.push(stringifyCurrency(openingBalAccum.toFixed(2)));
									//					log.debug('opening balance list grow', openingBalanceList);
									incomeList.push(stringifyCurrency(incomeAccum.toFixed(2)));
									expenseList.push(stringifyCurrency((expenseAccum.toFixed(2))));
									transferList.push(stringifyCurrency(transferAccum.toFixed(2)));
									surplusList.push(stringifyCurrency(netSurplus.toFixed(2)));
									closingBalanceList.push(stringifyCurrency(closingBalAccum.toFixed(2)));
								}

								if (className == 'Support') {
									existSupport = true;
									//    					try {
									var budgetVal1 = getBudgetWithinPeriod(postingPeriodInput, postingPeriodInput, currentPDFInstance, 2, printedfor, false, subsidCurr, false);
									var budgetVal2 = getBudgetWithinPeriod(getYearToDateMonth(postingPeriodInput), postingPeriodInput, currentPDFInstance, 2, printedfor, true, subsidCurr, false);
									var budgetVal3 = getBudgetWithinPeriod(getTrailing12Month(postingPeriodInput), postingPeriodInput, currentPDFInstance, 2, printedfor, true, subsidCurr, false);
									if ((!budgetVal1) || (budgetVal1 == 0) || (budgetVal1 == 0.00)) {
										var perc1 = 'NA';
									} else {
										var perc1 = (Math.round((+incomeAccum * 100 / +budgetVal1).toFixed(2))).toString() + '%';
									}
									if ((!budgetVal2) || (budgetVal2 == 0) || (budgetVal2 == 0.00)) {
										var perc2 = 'NA';
									} else {
										var perc2 = (Math.round((+supportIncomeYearToDate * 100 / +budgetVal2).toFixed(2))).toString() + '%';
									}
									if ((!budgetVal3) || (budgetVal3 == 0) || (budgetVal3 == 0.00)) {
										var perc3 = 'NA';
									} else {
										var perc3 = (Math.round((+supportIncome12Month * 100 / +budgetVal3).toFixed(2))).toString() + '%';
									}

									budget1line.push(stringifyCurrency(+incomeAccum.toFixed(2)));
									budget2line.push(stringifyCurrency(+supportIncomeYearToDate.toFixed(2)));
									budget3line.push(stringifyCurrency(+supportIncome12Month.toFixed(2)));
									budget1line.push(stringifyCurrency(budgetVal1));
									budget2line.push(stringifyCurrency(budgetVal2));
									budget3line.push(stringifyCurrency(budgetVal3));
									budget1line.push(perc1);
									budget2line.push(perc2);
									budget3line.push(perc3);
								}
							}
						}
						if (budget1line.length == 0) {
							budget1line.push('0.00');
							budget1line.push('0.00');
							budget1line.push('NA');
						}
						if (budget2line.length == 0) {
							budget2line.push('0.00');
							budget2line.push('0.00');
							budget2line.push('NA');
						}
						if (budget3line.length == 0) {
							budget3line.push('0.00');
							budget3line.push('0.00');
							budget3line.push('NA');
						}

						budgetParam.line1 = budget1line;
						budgetParam.line2 = budget2line;
						budgetParam.line3 = budget3line;

					} else {
						var perAccountIncomeList = [];
						var perAccountExpenseList = [];
						var perAccountPurchaseList = [];
						var netLine = [];
						var netActual = 0.00;
						var netYTD = 0.00;
						var netBudget = 0.00;
						var netBudgetYTD = 0.00;
						var netVariance = 0.00;
						var netVarianceYTD = 0.00;
						var netGap = " ";
						var netAnnualFinBudget = 0.00;
						var netLast12Month = 0.00;
						var openingBalForAll = 0.00;


						for (var z = 0; z < pdfInstanceData.length; z++) {
							var tranType = pdfInstanceData[z][0].values.accounttype;
							var tempListIncome = [];
							var tempListExpense = [];
							var tempListPurchase = [];

							for (var v = 0; v < pdfInstanceData[z].length; v++) {
								var lineSubsidiary = pdfInstanceData[z][v].values.custcol_lc_subsidiary_line;
								if (((!lineSubsidiary) || (lineSubsidiary == "")) || (subsidString == lineSubsidiary)) {
									var currType = pdfInstanceData[z][v].values.currency[0].text;
									// var tranType = pdfInstanceData[z][v].values.accounttype;
									var exchangeRate = pdfInstanceData[z][v].values.exchangerate;
									var accountType = pdfInstanceData[z][v].values.account[0].value;
									var postingPerSummary = pdfInstanceData[z][v].values.postingperiod[0].text;
									var parse1 = Date.parse('01 ' + postingPerSummary);
									var parse2 = Date.parse('01 ' + postingPeriodInput);

									if (tranType == 'Income') {
										tempListIncome.push(pdfInstanceData[z][v].values);
									} else if ((tranType == 'Expense') || (tranType == 'Other Expense')) {
										tempListExpense.push(pdfInstanceData[z][v].values);
									} else if (tranType == 'Cost of Goods Sold') {
										tempListPurchase.push(pdfInstanceData[z][v].values);
									} else if (accountType == advanceAccNumber) {
										// log.debug('triggered advances collection');
										listAdvances.push(pdfInstanceData[z][v].values);
									} else if (accountType == fundBal3000Number) {
										// log.debug('triggered opening collection');
										listProjOpeningsPast.push(pdfInstanceData[z][v].values);
									}


								}
							}

							if ((tranType == 'Income') && (tempListIncome.length > 0)) {
								perAccountIncomeList.push(tempListIncome);
							} else if (((tranType == 'Expense') || (tranType == 'Other Expense')) && (tempListExpense.length > 0)) {
								perAccountExpenseList.push(tempListExpense);
							} else if ((tranType == 'Cost of Goods Sold') && (tempListPurchase.length > 0)) {
								perAccountPurchaseList.push(tempListPurchase);
							}
						}
						var existIncome = false;
						var existExpense = false;
						var existCogs = false;
						if (perAccountIncomeList.length > 0) {


							for (var i = 0; i < perAccountIncomeList.length; i++) {
								var incomeActual = 0.00;
								var incomeYTD = 0.00;
								var incomeBudget = 0.00;
								var incomeBudgetYTD = 0.00;
								var incomeVariance = 0.00;
								var incomeVarianceYTD = 0.00;
								var incomeGap = " ";
								var incomeAnnualFinBudget = 0.00;
								var incomeLast12Month = 0.00;
								var withinMonth = false;
								var addYTD = false;

								var lineToPush = [];
								var accountID = perAccountIncomeList[i][0].account[0].value;
								var accountText = perAccountIncomeList[i][0].account[0].text;
								var accountTextList = accountText.split(' ');
								var accountDescList = (accountText.replace(accountTextList[0], "")).split(':');
								var tranType = perAccountIncomeList[i][0].accounttype;
								lineToPush.push(accountTextList[0] + accountDescList[accountDescList.length - 1]);
								for (var k = 0; k < perAccountIncomeList[i].length; k++) {

									var currType = perAccountIncomeList[i][k].currency[0].text;
									var tranType = perAccountIncomeList[i][k].accounttype;
									var exchangeRate = perAccountIncomeList[i][k].exchangerate;
									var accountType = perAccountIncomeList[i][k].account[0].value;
									var postingPerSummary = perAccountIncomeList[i][k].postingperiod[0].text;
									var debitOpen = perAccountIncomeList[i][k].debitamount;
									var parse1 = Date.parse('01 ' + postingPerSummary);
									var parse2 = Date.parse('01 ' + postingPeriodInput);
									if ((postingPeriodInput.indexOf('Oct') == -1) && (postingPeriodInput.indexOf('Nov') == -1) && (postingPeriodInput.indexOf('Dec') == -1)) {
										var ytdList = postingPeriodInput.split(' ');
										var ytd = +ytdList[ytdList.length - 1] - 1;
										var fullytd = '01 Oct ' + ytd.toString();
									} else {
										var ytdList = postingPeriodInput.split(' ');
										var ytd = +ytdList[ytdList.length - 1];
										var fullytd = '01 Oct ' + ytd.toString();
									}
									var parse3 = Date.parse(fullytd);
									var date2 = new Date(parse2);
									date2.setMonth(date2.getMonth() + 1);
									var parseInclusion = Date.parse(date2);
									date2.setMonth(date2.getMonth() - 12);
									var parse12Month = Date.parse(date2);

									if (postingPerSummary == postingPeriodInput) {
										existLines = true;
										existIncome = true;
										withinMonth = true;
										addYTD = true;
										// log.debug('entered equal month case');
										if ((debitOpen) && (debitOpen > 0)) {
											incomeActual = +incomeActual - Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											incomeYTD = +incomeYTD - Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											// netYTD = +netYTD - Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											incomeActual = +incomeActual + Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											incomeYTD = +incomeYTD + Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											// netYTD = +netYTD + Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}

									} else if ((parse3 <= parse1) && (parse1 < parse2)) {
										addYTD = true;
										if ((debitOpen) && (debitOpen > 0)) {
											incomeYTD = +incomeYTD - Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											// netYTD = +netYTD - Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											incomeYTD = +incomeYTD + Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											// netYTD = +netYTD + Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}
									if ((parse12Month <= parse1) && (parse1 < parseInclusion)) {
										addYTD = true;
										if ((debitOpen) && (debitOpen > 0)) {
											incomeLast12Month = +incomeLast12Month - Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											// netYTD = +netYTD - Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											incomeLast12Month = +incomeLast12Month + Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											// netYTD = +netYTD + Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}

									if (parse1 < parse2) {
										if ((debitOpen) && (debitOpen > 0)) {
											openingBalForAll = +openingBalForAll - Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											openingBalForAll = +openingBalForAll + Math.abs(+(convertMyCurrency((perAccountIncomeList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}
								}
								incomeBudget = getBudgetWithinPeriod(postingPeriodInput, postingPeriodInput, currentPDFInstance, 2, printedfor, false, subsidCurr, true, currentPDFInstance, accountID);
								incomeBudgetYTD = getBudgetWithinPeriod(getYearToDateMonth(postingPeriodInput), postingPeriodInput, currentPDFInstance, 2, printedfor, true, subsidCurr, true, currentPDFInstance, accountID);
								incomeAnnualFinBudget = getBudgetWithinPeriod(getYearToDateMonth(postingPeriodInput), getEndOfFinYear(postingPeriodInput), currentPDFInstance, 2, printedfor, true, subsidCurr, true, currentPDFInstance, accountID);

								var incomeVariance = ((+incomeActual - +incomeBudget).toFixed(2)).toString();

								var incomeVarianceYTD = ((+incomeYTD - +incomeBudgetYTD).toFixed(2)).toString();


								lineToPush.push(stringifyCurrency((+incomeActual).toFixed(2)));
								netActual = ((+netActual + +incomeActual).toFixed(2)).toString();
								lineToPush.push(stringifyCurrency((+incomeYTD).toFixed(2)));
								lineToPush.push(stringifyCurrency((+incomeBudget).toFixed(2)));
								lineToPush.push(stringifyCurrency((+incomeBudgetYTD).toFixed(2)));
								lineToPush.push(stringifyCurrency((+incomeVariance).toFixed(2)));
								lineToPush.push(stringifyCurrency((+incomeVarianceYTD).toFixed(2)));
								lineToPush.push(incomeGap);
								lineToPush.push(stringifyCurrency((+incomeAnnualFinBudget).toFixed(2)));
								lineToPush.push(stringifyCurrency((+incomeLast12Month).toFixed(2)));

								if (existIncome == true) {
									if ((addYTD == true) && (withinMonth == true)) {
										netYTD = ((+netYTD + +incomeYTD).toFixed(2)).toString();
										netVarianceYTD = ((+netVarianceYTD + +incomeVarianceYTD).toFixed(2)).toString();
									}
									netBudget = ((+netBudget + +incomeBudget).toFixed(2)).toString();
									netBudgetYTD = ((+netBudgetYTD + +incomeBudgetYTD).toFixed(2)).toString();
									netVariance = ((+netVariance + +incomeVariance).toFixed(2)).toString();

									netAnnualFinBudget = ((+netAnnualFinBudget + +incomeAnnualFinBudget).toFixed(2)).toString();
									netLast12Month = ((+netLast12Month + +incomeLast12Month).toFixed(2)).toString();
								}
								if (withinMonth == true) {
									projectIncomeList.push(lineToPush);
								}
							}

						}

						if (perAccountExpenseList.length > 0) {
							for (var i = 0; i < perAccountExpenseList.length; i++) {
								var expenseActual = 0.00;
								var expenseYTD = 0.00;
								var expenseBudget = 0.00;
								var expenseBudgetYTD = 0.00;
								var expenseVariance = 0.00;
								var expenseVarianceYTD = 0.00;
								var expenseGap = " ";
								var expenseAnnualFinBudget = 0.00;
								var expenseLast12Month = 0.00;
								var withinMonth = false;
								var addYTD = false;

								var lineToPush = [];
								var accountID = perAccountExpenseList[i][0].account[0].value;
								var accountText = perAccountExpenseList[i][0].account[0].text;
								var accountTextList = accountText.split(' ');
								var accountDescList = (accountText.replace(accountTextList[0], "")).split(':');
								var tranType = perAccountExpenseList[i][0].accounttype;
								lineToPush.push(accountTextList[0] + accountDescList[accountDescList.length - 1]);

								for (var k = 0; k < perAccountExpenseList[i].length; k++) {

									var currType = perAccountExpenseList[i][k].currency[0].text;
									var tranType = perAccountExpenseList[i][k].accounttype;
									var exchangeRate = perAccountExpenseList[i][k].exchangerate;
									var accountType = perAccountExpenseList[i][k].account[0].value;
									var postingPerSummary = perAccountExpenseList[i][k].postingperiod[0].text;
									var debitOpen = perAccountExpenseList[i][k].debitamount;
									var parse1 = Date.parse('01 ' + postingPerSummary);
									var parse2 = Date.parse('01 ' + postingPeriodInput);
									if ((postingPeriodInput.indexOf('Oct') == -1) && (postingPeriodInput.indexOf('Nov') == -1) && (postingPeriodInput.indexOf('Dec') == -1)) {
										var ytdList = postingPeriodInput.split(' ');
										var ytd = +ytdList[ytdList.length - 1] - 1;
										var fullytd = '01 Oct ' + ytd.toString();
									} else {
										var ytdList = postingPeriodInput.split(' ');
										var ytd = +ytdList[ytdList.length - 1];
										var fullytd = '01 Oct ' + ytd.toString();
									}
									var parse3 = Date.parse(fullytd);
									var date2 = new Date(parse2);
									date2.setMonth(date2.getMonth() + 1);
									var parseInclusion = Date.parse(date2);
									date2.setMonth(date2.getMonth() - 12);
									var parse12Month = Date.parse(date2);

									if (postingPerSummary == postingPeriodInput) {
										addYTD = true;
										// log.debug('entered equal month case');
										existExpense = true;
										existLines = true;
										withinMonth = true;
										if ((debitOpen) && (debitOpen > 0)) {
											expenseActual = +expenseActual - Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											expenseYTD = +expenseYTD - Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											expenseActual = +expenseActual + Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											expenseYTD = +expenseYTD + Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}

									} else if ((parse3 <= parse1) && (parse1 < parse2)) {
										addYTD = true;
										if ((debitOpen) && (debitOpen > 0)) {
											expenseYTD = +expenseYTD - Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											expenseYTD = +expenseYTD + Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}
									if ((parse12Month <= parse1) && (parse1 < parseInclusion)) {
										addYTD = true;
										if ((debitOpen) && (debitOpen > 0)) {
											expenseLast12Month = +expenseLast12Month - Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											expenseLast12Month = +expenseLast12Month + Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}
									if (parse1 < parse2) {
										if ((debitOpen) && (debitOpen > 0)) {
											openingBalForAll = +openingBalForAll - Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											openingBalForAll = +openingBalForAll + Math.abs(+(convertMyCurrency((perAccountExpenseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}
								}
								expenseBudget = getBudgetWithinPeriod(postingPeriodInput, postingPeriodInput, currentPDFInstance, 2, printedfor, false, subsidCurr, true, currentPDFInstance, accountID);
								expenseBudgetYTD = getBudgetWithinPeriod(getYearToDateMonth(postingPeriodInput), postingPeriodInput, currentPDFInstance, 2, printedfor, true, subsidCurr, true, currentPDFInstance, accountID);
								expenseAnnualFinBudget = getBudgetWithinPeriod(getYearToDateMonth(postingPeriodInput), getEndOfFinYear(postingPeriodInput), currentPDFInstance, 2, printedfor, true, subsidCurr, true, currentPDFInstance, accountID);

								var expenseVariance = ((+expenseActual - +expenseBudget).toFixed(2)).toString();

								var expenseVarianceYTD = ((+expenseYTD - +expenseBudgetYTD).toFixed(2)).toString();

								lineToPush.push(stringifyCurrency((+expenseActual).toFixed(2)));
								netActual = ((+netActual + +expenseActual).toFixed(2)).toString();
								lineToPush.push(stringifyCurrency((+expenseYTD).toFixed(2)));
								lineToPush.push(stringifyCurrency((+expenseBudget).toFixed(2)));
								lineToPush.push(stringifyCurrency((+expenseBudgetYTD).toFixed(2)));
								lineToPush.push(stringifyCurrency((+expenseVariance).toFixed(2)));
								lineToPush.push(stringifyCurrency((+expenseVarianceYTD).toFixed(2)));
								lineToPush.push(expenseGap);
								lineToPush.push(stringifyCurrency((+expenseAnnualFinBudget).toFixed(2)));
								lineToPush.push(stringifyCurrency((+expenseLast12Month).toFixed(2)));

								if (existExpense == true) {
									if ((addYTD == true) && (withinMonth == true)) {
										netYTD = ((+netYTD + +expenseYTD).toFixed(2)).toString();
										netVarianceYTD = ((+netVarianceYTD + +expenseVarianceYTD).toFixed(2)).toString();
									}
									netBudget = ((+netBudget + +expenseBudget).toFixed(2)).toString();
									netBudgetYTD = ((+netBudgetYTD + +expenseBudgetYTD).toFixed(2)).toString();
									netVariance = ((+netVariance + +expenseVariance).toFixed(2)).toString();

									netAnnualFinBudget = ((+netAnnualFinBudget + +expenseAnnualFinBudget).toFixed(2)).toString();
									netLast12Month = ((+netLast12Month + +expenseLast12Month).toFixed(2)).toString();
								}
								if (withinMonth == true) {
									projectExpenseList.push(lineToPush);
								}
							}

						}
						if (perAccountPurchaseList.length > 0) {
							for (var i = 0; i < perAccountPurchaseList.length; i++) {
								var cogsActual = 0.00;
								var cogsYTD = 0.00;
								var cogsBudget = 0.00;
								var cogsBudgetYTD = 0.00;
								var cogsVariance = 0.00;
								var cogsVarianceYTD = 0.00;
								var cogsGap = " ";
								var cogsAnnualFinBudget = 0.00;
								var cogsLast12Month = 0.00;
								var withinMonth = false;
								var addYTD = false;

								var lineToPush = [];
								var accountID = perAccountPurchaseList[i][0].account[0].value;
								var accountText = perAccountPurchaseList[i][0].account[0].text;
								var accountTextList = accountText.split(' ');
								var accountDescList = (accountText.replace(accountTextList[0], "")).split(':');
								var tranType = perAccountPurchaseList[i][0].accounttype;
								lineToPush.push(accountTextList[0] + accountDescList[accountDescList.length - 1]);
								for (var k = 0; k < perAccountPurchaseList[i].length; k++) {

									var currType = perAccountPurchaseList[i][k].currency[0].text;
									var tranType = perAccountPurchaseList[i][k].accounttype;
									var exchangeRate = perAccountPurchaseList[i][k].exchangerate;
									var accountType = perAccountPurchaseList[i][k].account[0].value;
									var postingPerSummary = perAccountPurchaseList[i][k].postingperiod[0].text;
									var debitOpen = perAccountPurchaseList[i][k].debitamount;
									var parse1 = Date.parse('01 ' + postingPerSummary);
									var parse2 = Date.parse('01 ' + postingPeriodInput);
									if ((postingPeriodInput.indexOf('Oct') == -1) && (postingPeriodInput.indexOf('Nov') == -1) && (postingPeriodInput.indexOf('Dec') == -1)) {
										var ytdList = postingPeriodInput.split(' ');
										var ytd = +ytdList[ytdList.length - 1] - 1;
										var fullytd = '01 Oct ' + ytd.toString();
									} else {
										var ytdList = postingPeriodInput.split(' ');
										var ytd = +ytdList[ytdList.length - 1];
										var fullytd = '01 Oct ' + ytd.toString();
									}
									var parse3 = Date.parse(fullytd);
									var date2 = new Date(parse2);
									date2.setMonth(date2.getMonth() + 1);
									var parseInclusion = Date.parse(date2);
									date2.setMonth(date2.getMonth() - 12);
									var parse12Month = Date.parse(date2);

									if (postingPerSummary == postingPeriodInput) {
										addYTD = true;
										existCogs = true;
										existLines = true;
										withinMonth = true;
										if ((debitOpen) && (debitOpen > 0)) {
											cogsActual = +cogsActual - Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											cogsYTD = +cogsYTD - Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											cogsActual = +cogsActual + Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
											cogsYTD = +cogsYTD + Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}

									} else if ((parse3 <= parse1) && (parse1 < parse2)) {
										addYTD = true;
										if ((debitOpen) && (debitOpen > 0)) {
											cogsYTD = +cogsYTD - Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											cogsYTD = +cogsYTD + Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}
									if ((parse12Month <= parse1) && (parse1 < parseInclusion)) {
										addYTD = true;
										if ((debitOpen) && (debitOpen > 0)) {
											cogsLast12Month = +cogsLast12Month - Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											cogsLast12Month = +cogsLast12Month + Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}
									if (parse1 < parse2) {
										if ((debitOpen) && (debitOpen > 0)) {
											openingBalForAll = +openingBalForAll - Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										} else {
											openingBalForAll = +openingBalForAll + Math.abs(+(convertMyCurrency((perAccountPurchaseList[i][k].fxamount), currType, subsidCurr, exchangeRate)));
										}
									}
								}
								cogsBudget = getBudgetWithinPeriod(postingPeriodInput, postingPeriodInput, currentPDFInstance, 2, printedfor, false, subsidCurr, true, currentPDFInstance, accountID);
								cogsBudgetYTD = getBudgetWithinPeriod(getYearToDateMonth(postingPeriodInput), postingPeriodInput, currentPDFInstance, 2, printedfor, true, subsidCurr, true, currentPDFInstance, accountID);
								cogsAnnualFinBudget = getBudgetWithinPeriod(getYearToDateMonth(postingPeriodInput), getEndOfFinYear(postingPeriodInput), currentPDFInstance, 2, printedfor, true, subsidCurr, true, currentPDFInstance, accountID);

								var cogsVariance = ((+cogsActual - +cogsBudget).toFixed(2)).toString();

								var cogsVarianceYTD = ((+cogsYTD - +cogsBudgetYTD).toFixed(2)).toString();

								lineToPush.push(stringifyCurrency((+cogsActual).toFixed(2)));
								netActual = ((+netActual + +cogsActual).toFixed(2)).toString();
								lineToPush.push(stringifyCurrency((+cogsYTD).toFixed(2)));
								lineToPush.push(stringifyCurrency((+cogsBudget).toFixed(2)));
								lineToPush.push(stringifyCurrency((+cogsBudgetYTD).toFixed(2)));
								lineToPush.push(stringifyCurrency((+cogsVariance).toFixed(2)));
								lineToPush.push(stringifyCurrency((+cogsVarianceYTD).toFixed(2)));
								lineToPush.push(cogsGap);
								lineToPush.push(stringifyCurrency((+cogsAnnualFinBudget).toFixed(2)));
								lineToPush.push(stringifyCurrency((+cogsLast12Month).toFixed(2)));

								if (existCogs == true) {
									// log.debug('increment by row cogs', cogsYTD);
									if ((addYTD == true) && (withinMonth == true)) {
										netYTD = ((+netYTD + +cogsYTD).toFixed(2)).toString();
										netVarianceYTD = ((+netVarianceYTD + +cogsVarianceYTD).toFixed(2)).toString();
									}

									// log.debug('netYTD progress', netYTD);
									netBudget = ((+netBudget + +cogsBudget).toFixed(2)).toString();
									netBudgetYTD = ((+netBudgetYTD + +cogsBudgetYTD).toFixed(2)).toString();
									netVariance = ((+netVariance + +cogsVariance).toFixed(2)).toString();

									netAnnualFinBudget = ((+netAnnualFinBudget + +cogsAnnualFinBudget).toFixed(2)).toString();
									netLast12Month = ((+netLast12Month + +cogsLast12Month).toFixed(2)).toString();
								}
								if (withinMonth == true) {
									projectPurchaseList.push(lineToPush);
								}
							}
						}
						netLine.push(stringifyCurrency((+netActual).toFixed(2)));

						netLine.push(stringifyCurrency((+netYTD).toFixed(2)));
						netLine.push(stringifyCurrency((+netBudget).toFixed(2)));
						netLine.push(stringifyCurrency((+netBudgetYTD).toFixed(2)));
						netLine.push(stringifyCurrency((+netVariance).toFixed(2)));
						netLine.push(stringifyCurrency((+netVarianceYTD).toFixed(2)));
						netLine.push(netGap);
						netLine.push(stringifyCurrency((+netAnnualFinBudget).toFixed(2)));
						netLine.push(stringifyCurrency((+netLast12Month).toFixed(2)));

						var advancesOpening = 0.00;
						if (listAdvances.length != 0) {

							for (var i = 0; i < listAdvances.length; i++) {
								var postingPerSummary = listAdvances[i].postingperiod[0].text;
								var parse1 = Date.parse('01 ' + postingPerSummary);
								var parse2 = Date.parse('01 ' + postingPeriodInput);
								if (postingPerSummary == postingPeriodInput) {
									existLines = true;
								}
								if (parse1 < parse2) {
									var debitOpen = listAdvances[i].debitamount;
									var currType = listAdvances[i].currency[0].text;
									var tranType = listAdvances[i].accounttype;
									var exchangeRate = listAdvances[i].exchangerate;
									if ((debitOpen) && (debitOpen > 0)) {
										advancesOpening = +advancesOpening - Math.abs(+(convertMyCurrency((listAdvances[i].fxamount), currType, subsidCurr, exchangeRate)));
									} else {
										advancesOpening = +advancesOpening + Math.abs(+(convertMyCurrency((listAdvances[i].fxamount), currType, subsidCurr, exchangeRate)));
									}
								}
								if ((((+advancesOpening).toFixed(2)) != 0) && (((+advancesOpening).toFixed(2)) != 0.00) && (advancesOpening != '(0.00)')) {
									existLines = true;
								}
							}
						}
						if (listProjOpeningsPast.length != 0) {
							for (var i = 0; i < listProjOpeningsPast.length; i++) {
								var postingPerSummary = listProjOpeningsPast[i].postingperiod[0].text;
								var parse1 = Date.parse('01 ' + postingPerSummary);
								var parse2 = Date.parse('01 ' + postingPeriodInput);
								var date1 = new Date(parse1);
								var date2 = new Date(parse2);
								date2.setMonth(date2.getMonth() + 1);
								var parseInclusion = Date.parse(date2);
								if (parse1 < parseInclusion) {
									var debitOpen = listProjOpeningsPast[i].debitamount;
									var currType = listProjOpeningsPast[i].currency[0].text;
									var tranType = listProjOpeningsPast[i].accounttype;
									var exchangeRate = listProjOpeningsPast[i].exchangerate;
									if ((debitOpen) && (debitOpen > 0)) {
										openingBalForAll = +openingBalForAll - Math.abs(+(convertMyCurrency((listProjOpeningsPast[i].fxamount), currType, subsidCurr, exchangeRate)));
									} else {
										openingBalForAll = +openingBalForAll + Math.abs(+(convertMyCurrency((listProjOpeningsPast[i].fxamount), currType, subsidCurr, exchangeRate)));
									}
								}

							}
						}
						if ((((+openingBalForAll).toFixed(2)) != 0) && (((+openingBalForAll).toFixed(2)) != 0.00) && (((+openingBalForAll).toFixed(2)) != '(0.00)')) {
							existLines = true;
						}
					}
					if ((existLines == true)) {
						var classOrderListByName = ['Support', 'Housing', 'Passage', 'Medical', 'MK Education', 'Salary pool', 'Future Support', 'Retirement', 'Ministry'];
						var newclassList = [];
						var newclassNameList = [];
						var newopeningBalanceList = [];
						var newincomeList = [];
						var newexpenseList = [];
						var newtransferList = [];
						var newsurplusList = [];
						var newclosingBalanceList = [];
						for (var y = 0; y < classOrderListByName.length; y++) {
							var orderedClass = classOrderListByName[y];
							var indexToUse = classNameList.indexOf(orderedClass);
							if (indexToUse != -1) {
								newclassList.push(classList[indexToUse]);
								newclassNameList.push(classNameList[indexToUse]);
								newopeningBalanceList.push(openingBalanceList[indexToUse]);
								newincomeList.push(incomeList[indexToUse]);
								newexpenseList.push(expenseList[indexToUse]);
								newtransferList.push(transferList[indexToUse]);
								newsurplusList.push(surplusList[indexToUse]);
								newclosingBalanceList.push(closingBalanceList[indexToUse]);

							}

						}
						summaryParam.classlist = newclassList;
						summaryParam.classnamelist = newclassNameList;
						summaryParam.openingbalancelist = newopeningBalanceList;
						summaryParam.incomelist = newincomeList;
						summaryParam.expenselist = newexpenseList;
						summaryParam.transferlist = newtransferList;
						summaryParam.surpluslist = newsurplusList;
						summaryParam.closingbalancelist = newclosingBalanceList;

						jsonParam.reporttype = reportTypeString;
						jsonParam.printedby = printedBy;
						jsonParam.subsidiary = subsidString;
						jsonParam.timestamp = timeStamp;
						jsonParam.classadmin = listAdmin;
						jsonParam.postingperiod = postingPeriodInput;
						jsonParam.classsupport = listSupport;
						jsonParam.classministry = listMinistry;
						jsonParam.personalaccount = listPersonalAccount;
						jsonParam.personalaccountopening = personalAccountOpening;
						jsonParam.fringebenefit = listFringeBenefit;
						jsonParam.fringebenefitopening = fringeBenefitOpening;
						jsonParam.projectid = codeToUse;
						jsonParam.currency = subsidCurr;
						jsonParam.transactions = pdfInstanceData;
						//Params for project
						jsonParam.advancesaccountopening = advancesOpening;
						jsonParam.advances = listAdvances;

						summaryProjParam.incomeList = projectIncomeList;
						summaryProjParam.expenseList = projectExpenseList;
						summaryProjParam.cogsList = projectPurchaseList;
						summaryProjParam.netLine = netLine;
						summaryProjParam.allopening = (stringifyCurrency((+openingBalForAll).toFixed(2)));

						if (reportType == 'worker') {
							var pdfXml = generatePDF_XML(jsonParam, summaryParam, postingPeriodInput, budgetParam, subsidCurr, subsidString, printedfor, interfundNumber);
						} else {
							var pdfXml = generatePDF_XML_proj(jsonParam, summaryParam, postingPeriodInput, budgetParam, subsidCurr, subsidString, summaryProjParam, interfundNumber);
						}

						var pdfFile = render.xmlToPdf({
							xmlString: pdfXml.split('&').join('&amp;')
						});
						if (subsidPrefix.indexOf('_') == -1) {
							pdfFile.name = subsidPrefix + '_' + codeToUse + '_' + (counter - 1).toString() + '_' + timeStamp + '.pdf';
						} else {
							pdfFile.name = subsidPrefix + codeToUse + '_' + (counter - 1).toString() + '_' + timeStamp + '.pdf';
						}

						pdfFile.folder = subfolderID;
						var fileid = pdfFile.save();
						massSendEmail(loopList[q], trackerID, printedfor, reportType, fileid, triggerEmail, postingPeriodInput, combinedDate);
						log.debug('pdf file generated');
					} else {
						if (existBudget == false) {
							log.debug('no transaction data matches the input month period');
						}

					}
				} else {
					log.debug('No transaction data at all found');
				}
			}
			updateParentTracker(trackerID, "Completed");
			if (reportType == 'worker') {
				individualSummaryEmail(trackerID, triggerEmail, printedfor, subfolderID, loopList, titleAppend, 'worker', printedById);
			} else {
				individualSummaryEmail(trackerID, triggerEmail, printedfor, subfolderID, loopList, titleAppend, 'project', printedById);
			}

		}

		return {
			getInputData: getInputData,
			map: map,
			reduce: reduce,
			summarize: summarize
		};

	});
