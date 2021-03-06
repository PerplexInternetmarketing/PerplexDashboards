﻿angular.module("umbraco").controller("PerplexDashboards.MemberDashboard.LockedMembersListViewController", [
    "$rootScope",
    "$scope",
    "$routeParams",
    "$injector",
    "$cookieStore",
    "notificationsService",
    "iconHelper",
    "dialogService",
    "editorState",
    "localizationService",
    "$location",
    "appState",
    "$timeout",
    "$q",
    "mediaResource",
    "listViewHelper",
    "Perplex.MemberDashboard.Api",
    function listViewController(
        $rootScope,
        $scope,
        $routeParams,
        $injector,
        $cookieStore,
        notificationsService,
        iconHelper,
        dialogService,
        editorState,
        localizationService,
        $location,
        appState,
        $timeout,
        $q,
        mediaResource,
        listViewHelper,
        perplexMembersDashboardApi
    ) {
        //this is a quick check to see if we're in create mode, if so just exit - we cannot show children for content
        // that isn't created yet, if we continue this will use the parent id in the route params which isn't what
        // we want. NOTE: This is just a safety check since when we scaffold an empty model on the server we remove
        // the list view tab entirely when it's new.
        if ($routeParams.create) {
            $scope.isNew = true;
            return;
        }

        //Now we need to check if this is for media, members or content because that will depend on the resources we use
        var contentResource,
            getContentTypesCallback,
            getListResultsCallback,
            deleteItemCallback,
            getIdCallback,
            createEditUrlCallback;

        // Altijd de results + id callback van ons gebruiken
        getListResultsCallback = perplexMembersDashboardApi.getLockedMembersListView;
        getIdCallback = function(selected) {
            return selected.id;
        };

        //check the config for the entity type, or the current section name (since the config is only set in c#, not in pre-vals)
        if (
            ($scope.model.config.entityType && $scope.model.config.entityType === "member") ||
            appState.getSectionState("currentSection") === "member"
        ) {
            $scope.entityType = "member";
            contentResource = $injector.get("memberResource");
            getContentTypesCallback = $injector.get("memberTypeResource").getTypes;
            deleteItemCallback = contentResource.deleteByKey;
            createEditUrlCallback = function(item) {
                return (
                    "/" +
                    $scope.entityType +
                    "/" +
                    $scope.entityType +
                    "/edit/" +
                    item.key +
                    "?page=" +
                    $scope.options.pageNumber +
                    "&listName=" +
                    $scope.contentId
                );
            };
        } else {
            //check the config for the entity type, or the current section name (since the config is only set in c#, not in pre-vals)
            if (
                ($scope.model.config.entityType && $scope.model.config.entityType === "media") ||
                appState.getSectionState("currentSection") === "media"
            ) {
                $scope.entityType = "media";
                contentResource = $injector.get("mediaResource");
                getContentTypesCallback = $injector.get("mediaTypeResource").getAllowedTypes;
            } else {
                $scope.entityType = "content";
                contentResource = $injector.get("contentResource");
                getContentTypesCallback = $injector.get("contentTypeResource").getAllowedTypes;
            }
            deleteItemCallback = contentResource.deleteById;
            createEditUrlCallback = function(item) {
                return (
                    "/" +
                    $scope.entityType +
                    "/" +
                    $scope.entityType +
                    "/edit/" +
                    item.id +
                    "?page=" +
                    $scope.options.pageNumber
                );
            };
        }

        $scope.pagination = [];
        $scope.isNew = false;
        $scope.actionInProgress = false;
        $scope.selection = [];
        $scope.folders = [];
        $scope.listViewResultSet = {
            totalPages: 0,
            items: []
        };

        $scope.model.config.layouts = [
            {
                name: "List",
                path: "views/propertyeditors/listview/layouts/list/list.html",
                icon: "icon-list",
                isSystem: 1,
                selected: true
            },
            {
                name: "Grid",
                path: "views/propertyeditors/listview/layouts/grid/grid.html",
                icon: "icon-thumbnails-small",
                isSystem: 1,
                selected: true
            }
        ];

        $scope.model.config.bulkActionPermissions = {
            allowBulkPublish: true,
            allowBulkUnpublish: true,
            allowBulkCopy: true,
            allowBulkMove: true,
            allowBulkDelete: true
        };

        $scope.options = {
            pageSize: $scope.model.config.pageSize ? $scope.model.config.pageSize : 10,
            pageNumber:
                $routeParams.page && Number($routeParams.page) != NaN && Number($routeParams.page) > 0
                    ? $routeParams.page
                    : 1,
            filter: "",
            orderBy: ($scope.model.config.orderBy ? $scope.model.config.orderBy : "Name").trim(),
            orderDirection: $scope.model.config.orderDirection ? $scope.model.config.orderDirection.trim() : "asc",
            includeProperties: $scope.model.config.includeProperties
                ? $scope.model.config.includeProperties
                : [
                      { alias: "updateDate", header: "Last edited", isSystem: 1 },
                      { alias: "updater", header: "Last edited by", isSystem: 1 }
                  ],
            layout: {
                layouts: $scope.model.config.layouts,
                activeLayout: listViewHelper.getLayout($routeParams.id, $scope.model.config.layouts)
            },
            allowBulkPublish:
                $scope.entityType === "content" && $scope.model.config.bulkActionPermissions.allowBulkPublish,
            allowBulkUnpublish:
                $scope.entityType === "content" && $scope.model.config.bulkActionPermissions.allowBulkUnpublish,
            allowBulkCopy: $scope.entityType === "content" && $scope.model.config.bulkActionPermissions.allowBulkCopy,
            allowBulkMove: $scope.model.config.bulkActionPermissions.allowBulkMove,
            allowBulkDelete: $scope.model.config.bulkActionPermissions.allowBulkDelete
        };

        $scope.options.includeProperties = [
            {
                alias: "Email",
                header: "E-mail",
                isSystem: 0,
                allowSorting: true
            },
            {
                alias: "LastLoginDate",
                header: "Last login date",
                isSystem: 0,
                allowSorting: true
            }
        ];

        //update all of the system includeProperties to enable sorting
        _.each($scope.options.includeProperties, function(e, i) {
            if (e.isSystem) {
                //NOTE: special case for contentTypeAlias, it's a system property that cannot be sorted
                // to do that, we'd need to update the base query for content to include the content type alias column
                // which requires another join and would be slower. BUT We are doing this for members so not sure it makes a diff?
                if (e.alias != "contentTypeAlias") {
                    e.allowSorting = true;
                }

                //localize the header
                var key = getLocalizedKey(e.alias);
                localizationService.localize(key).then(function(v) {
                    e.header = v;
                });
            }
        });

        $scope.selectLayout = function(selectedLayout) {
            $scope.options.layout.activeLayout = listViewHelper.setLayout(
                $routeParams.id,
                selectedLayout,
                $scope.model.config.layouts
            );
        };

        function showNotificationsAndReset(err, reload, successMsg) {
            //check if response is ysod
            if (err.status && err.status >= 500) {
                // Open ysod overlay
                $scope.ysodOverlay = {
                    view: "ysod",
                    error: err,
                    show: true
                };
            }

            $timeout(function() {
                $scope.bulkStatus = "";
                $scope.actionInProgress = false;
            }, 500);

            if (reload === true) {
                $scope.reloadView($scope.contentId);
            }

            if (err.data && angular.isArray(err.data.notifications)) {
                for (var i = 0; i < err.data.notifications.length; i++) {
                    notificationsService.showNotification(err.data.notifications[i]);
                }
            } else if (successMsg) {
                notificationsService.success("Done", successMsg);
            }
        }

        $scope.next = function(pageNumber) {
            $scope.options.pageNumber = pageNumber;
            $scope.reloadView($scope.contentId);
        };

        $scope.goToPage = function(pageNumber) {
            $scope.options.pageNumber = pageNumber;
            $scope.reloadView($scope.contentId);
        };

        $scope.prev = function(pageNumber) {
            $scope.options.pageNumber = pageNumber;
            $scope.reloadView($scope.contentId);
        };

        /*Loads the search results, based on parameters set in prev,next,sort and so on*/
        /*Pagination is done by an array of objects, due angularJS's funky way of monitoring state
    with simple values */

        $scope.reloadView = function(id) {
            $scope.viewLoaded = false;

            listViewHelper.clearSelection($scope.listViewResultSet.items, $scope.folders, $scope.selection);

            getListResultsCallback(id, $scope.options).then(function(data) {
                $scope.actionInProgress = false;

                $scope.listViewResultSet = data;
                $scope.viewLoaded = true;

                //NOTE: This might occur if we are requesting a higher page number than what is actually available, for example
                // if you have more than one page and you delete all items on the last page. In this case, we need to reset to the last
                // available page and then re-load again
                if ($scope.options.pageNumber > $scope.listViewResultSet.totalPages) {
                    $scope.options.pageNumber = $scope.listViewResultSet.totalPages;

                    //reload!
                    $scope.reloadView(id);
                }
            });
        };

        var searchListView = _.debounce(function() {
            $scope.$apply(function() {
                makeSearch();
            });
        }, 500);

        $scope.forceSearch = function(ev) {
            //13: enter
            switch (ev.keyCode) {
                case 13:
                    makeSearch();
                    break;
            }
        };

        $scope.enterSearch = function() {
            $scope.viewLoaded = false;
            searchListView();
        };

        function makeSearch() {
            if ($scope.options.filter !== null && $scope.options.filter !== undefined) {
                $scope.options.pageNumber = 1;
                //$scope.actionInProgress = true;
                $scope.reloadView($scope.contentId);
            }
        }

        $scope.isAnythingSelected = function() {
            if ($scope.selection.length === 0) {
                return false;
            } else {
                return true;
            }
        };

        $scope.selectedItemsCount = function() {
            return $scope.selection.length;
        };

        $scope.clearSelection = function() {
            listViewHelper.clearSelection($scope.listViewResultSet.items, $scope.folders, $scope.selection);
        };

        $scope.getIcon = function(entry) {
            return iconHelper.convertFromLegacyIcon(entry.icon);
        };

        function serial(selected, fn, getStatusMsg, index) {
            return fn(selected, index).then(
                function(content) {
                    index++;
                    $scope.bulkStatus = getStatusMsg(index, selected.length);
                    return index < selected.length ? serial(selected, fn, getStatusMsg, index) : content;
                },
                function(err) {
                    var reload = index > 0;
                    showNotificationsAndReset(err, reload);
                    return err;
                }
            );
        }

        function applySelected(fn, getStatusMsg, getSuccessMsg, confirmMsg) {
            var selected = $scope.selection;
            if (selected.length === 0) return;
            if (confirmMsg && !confirm(confirmMsg)) return;

            $scope.actionInProgress = true;
            $scope.bulkStatus = getStatusMsg(0, selected.length);

            serial(selected, fn, getStatusMsg, 0).then(function(result) {
                // executes once the whole selection has been processed
                // in case of an error (caught by serial), result will be the error
                if (!(result.data && angular.isArray(result.data.notifications)))
                    showNotificationsAndReset(result, true, getSuccessMsg(selected.length));
            });
        }

        $scope.unlock = function() {
            applySelected(
                function(selected, index) {
                    return perplexMembersDashboardApi.unlockMember(getIdCallback(selected[index]));
                },
                function(count, total) {
                    return "Unlocked " + count + " out of " + total + " member" + (total > 1 ? "s" : "");
                },
                function(total) {
                    return "Unlocked " + total + " member" + (total > 1 ? "s" : "");
                }
            );
        };

        function getCustomPropertyValue(alias, properties) {
            var value = "";
            var index = 0;
            var foundAlias = false;
            for (var i = 0; i < properties.length; i++) {
                if (properties[i].alias == alias) {
                    foundAlias = true;
                    break;
                }
                index++;
            }

            if (foundAlias) {
                value = properties[index].value;
            }

            return value;
        }

        function isDate(val) {
            if (angular.isString(val)) {
                return val.match(/^(\d{4})\-(\d{2})\-(\d{2})\ (\d{2})\:(\d{2})\:(\d{2})$/);
            }
            return false;
        }

        function initView() {
            //default to root id if the id is undefined
            var id = $routeParams.id;
            if (id === undefined) {
                id = -1;
            }

            // DK | 2016-11-21
            // Geen Create knop
            $scope.listViewAllowedTypes = []; // getContentTypesCallback(id);

            $scope.contentId = id;
            $scope.isTrashed = id === "-20" || id === "-21";

            $scope.options.allowBulkPublish = $scope.options.allowBulkPublish && !$scope.isTrashed;
            $scope.options.allowBulkUnpublish = $scope.options.allowBulkUnpublish && !$scope.isTrashed;

            $scope.options.bulkActionsAllowed =
                $scope.options.allowBulkPublish ||
                $scope.options.allowBulkUnpublish ||
                $scope.options.allowBulkCopy ||
                $scope.options.allowBulkMove ||
                $scope.options.allowBulkDelete;

            $scope.reloadView($scope.contentId);
        }

        function getLocalizedKey(alias) {
            switch (alias) {
                case "sortOrder":
                    return "general_sort";
                case "updateDate":
                    return "content_updateDate";
                case "updater":
                    return "content_updatedBy";
                case "createDate":
                    return "content_createDate";
                case "owner":
                    return "content_createBy";
                case "published":
                    return "content_isPublished";
                case "contentTypeAlias":
                    //TODO: Check for members
                    return $scope.entityType === "content" ? "content_documentType" : "content_mediatype";
                case "email":
                    return "general_email";
                case "username":
                    return "general_username";
            }
            return alias;
        }

        function getItemKey(itemId) {
            for (var i = 0; i < $scope.listViewResultSet.items.length; i++) {
                var item = $scope.listViewResultSet.items[i];
                if (item.id === itemId) {
                    return item.key;
                }
            }
        }

        $scope.initView = initView;
    }
]);
