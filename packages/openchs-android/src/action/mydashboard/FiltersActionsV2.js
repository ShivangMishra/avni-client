import DashboardFilterService from "../../service/reports/DashboardFilterService";
import _ from "lodash";
import {ArrayUtil, Concept, CustomFilter, ModelGeneral} from 'openchs-models';
import CustomDashboardCacheService from '../../service/CustomDashboardCacheService';

import General from "../../utility/General";

class FiltersActionsV2 {
    static getInitialState() {
        return {
            dashboardUUID: '',
            loading: false,
            filters: [],
            filterErrors: {},
            selectedValues: {},
            filterApplied: false
        };
    }

    static onLoad(state, action, context) {
        const dashboardFilterService = context.get(DashboardFilterService);
        const filterConfigs = dashboardFilterService.getFilterConfigsForDashboard(action.dashboardUUID);
        const filters = dashboardFilterService.getFilters(action.dashboardUUID);
        const {selectedFilterValues, dashboardCache} = context.get(CustomDashboardCacheService).getDashboardCache(action.dashboardUUID);
        return  {
            ...state,
            filterConfigs: filterConfigs,
            filters: filters,
            loading: false,
            dashboardUUID: action.dashboardUUID,
            filterApplied: dashboardCache.filterApplied,
            selectedValues: selectedFilterValues
        };
    }

    static onFilterUpdate(state, action) {
        const {filter, value} = action;
        const {filterConfigs} = state;

        const filterConfig = filterConfigs[filter.uuid];
        const inputDataType = filterConfig.getInputDataType();
        const currentFilterValue = state.selectedValues[filter.uuid];
        const isRange = filterConfig.widget === CustomFilter.widget.Range;

        const newState = {...state};
        newState.selectedValues = {...state.selectedValues};

        if (filterConfig.type === CustomFilter.type.SubjectType) {
            newState.selectedValues[filter.uuid] = action.value.clone();
            return newState;
        }

        let updatedValue;
        switch (inputDataType) {
            case Concept.dataType.Coded:
            case CustomFilter.type.Gender:
                updatedValue = _.isNil(currentFilterValue) ? [] : [...currentFilterValue];
                ArrayUtil.toggle(updatedValue, value, (a, b) => a.uuid === b.uuid);
                break;

            case CustomFilter.type.Address:
                updatedValue = General.deepOmit(value, 'locationMappings'); //including locationMappings causes cyclical reference errors during JSON.stringify
                break;
            case Concept.dataType.Subject:
            case Concept.dataType.Text :
            case Concept.dataType.Notes :
            case Concept.dataType.Id :
                updatedValue = value;
                break;

            case Concept.dataType.Numeric:
            case Concept.dataType.Date:
            case Concept.dataType.DateTime:
            case Concept.dataType.Time:
                updatedValue = isRange ? {...currentFilterValue, ...value} : value;
                break;
        }

        newState.selectedValues[filter.uuid] = updatedValue;
        return newState;
    }

    static beforeFilterApply(state) {
        return {...state, loading: true};
    }

    static appliedFilter(state, action, context) {
        //Init data
        const {filterConfigs, selectedValues} = state;
        const {navigateToDashboardView, setFiltersDataOnDashboardView} = action;
        const newState = {...state, filterApplied: true, filterErrors: {}};
        const filledFilterValues = _.filter(Object.entries(selectedValues), ([, filterValue]) => !ModelGeneral.isDeepEmpty(filterValue));
        //Check if there are errors in filter values specified
        filledFilterValues.forEach(([filterUUID, filterValue]) => {
            const [success, message] = filterConfigs[filterUUID].validate && filterConfigs[filterUUID].validate(filterValue) || [false, `validate for filterConfig ${filterUUID} not found`];
            if (!success)
                newState.filterErrors[filterUUID] = message;
        });
        if (Object.keys(newState.filterErrors).length > 0) {
            newState.filterApplied = false;
            newState.loading = false;
            return newState;
        }
        const dashboardFilterService = context.get(DashboardFilterService);
        const ruleInputArray = filledFilterValues
            .map(([filterUUID, filterValue]) => dashboardFilterService.toRuleInputObject(filterConfigs[filterUUID], filterValue));

        const customDashboardCacheService = context.get(CustomDashboardCacheService);
        customDashboardCacheService.setSelectedFilterValues(newState.dashboardUUID, selectedValues, true);

        //Invoke callbacks. Used only in test.
        // setFiltersDataOnDashboardView(serializableFilterData);
        navigateToDashboardView(ruleInputArray);
        return newState;
    }

    static clearFilter(state, action, context) {
        const customDashboardCacheService = context.get(CustomDashboardCacheService);
        customDashboardCacheService.reset(state.dashboardUUID);
        return {...state, filterApplied: false, selectedValues: {}, filterErrors: {}};
    }
}

const FilterActionPrefix = 'FilterAV2';
const FilterActionNames = {
    ON_LOAD: `${FilterActionPrefix}.ON_LOAD`,
    ON_FILTER_UPDATE: `${FilterActionPrefix}.ON_FILTER_UPDATE`,
    BEFORE_APPLY_FILTER: `${FilterActionPrefix}.BEFORE_APPLY_FILTER`,
    APPLIED_FILTER: `${FilterActionPrefix}.APPLIED_FILTER`,
    CLEAR_FILTER: `${FilterActionPrefix}.CLEAR_FILTER`,
};

const FilterActionMapV2 = new Map([
    [FilterActionNames.ON_LOAD, FiltersActionsV2.onLoad],
    [FilterActionNames.ON_FILTER_UPDATE, FiltersActionsV2.onFilterUpdate],
    [FilterActionNames.BEFORE_APPLY_FILTER, FiltersActionsV2.beforeFilterApply],
    [FilterActionNames.APPLIED_FILTER, FiltersActionsV2.appliedFilter],
    [FilterActionNames.CLEAR_FILTER, FiltersActionsV2.clearFilter],
]);

export {
    FiltersActionsV2, FilterActionPrefix, FilterActionMapV2, FilterActionNames
}
