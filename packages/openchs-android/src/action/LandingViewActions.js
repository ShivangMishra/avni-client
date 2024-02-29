import _ from 'lodash'
import CustomDashboardService from '../service/customDashboard/CustomDashboardService';

class LandingViewActions {
    static getInitialState() {
        return {
            renderCustomDashboard: false,
            dummy: false,
            home: false,
            search: false,
            register: false,
            menu: false,
            dashboard: false,
            syncRequired: true,
            previouslySelectedSubjectTypeUUID: null
        };
    }

    static reset(state) {
        return {
            ...state,
            renderCustomDashboard: false,
            home: false,
            search: false,
            register: false,
            menu: false,
            dashboard: false,
        }
    }

    static onLoad(state, action, context) {
        const newState = LandingViewActions.reset(state);
        const syncRequired = _.isNil(action.syncRequired) ? true : action.syncRequired;
        const customDashboardService = context.get(CustomDashboardService);
        const renderCustomDashboard = customDashboardService.isCustomDashboardMarkedPrimary();
        return {
            ...newState,
            dummy: !state.dummy,
            home: true,
            syncRequired,
            renderCustomDashboard,
            previouslySelectedSubjectTypeUUID: action.cachedSubjectTypeUUID || newState.previouslySelectedSubjectTypeUUID,
        };
    }

    static onHomeClick(state) {
        const newState = LandingViewActions.reset(state);
        return {
            ...newState,
            home: true,
        }
    }

    static onSearchClick(state) {
        const newState = LandingViewActions.reset(state);
        return {
            ...newState,
            search: true,
        }
    }

    static onDashboardClick(state) {
        const newState = LandingViewActions.reset(state);
        return {
            ...newState,
            dashboard: true,
        }
    }

    static onRegisterClick(state) {
        const newState = LandingViewActions.reset(state);
        return {
            ...newState,
            register: true,
        }
    }

    static onMenuClick(state) {
        const newState = LandingViewActions.reset(state);
        return {
            ...newState,
            menu: true,
        }
    }
}

const LandingViewActionsNames = {
    ON_LOAD: 'LVA.ON_LOAD',
    ON_HOME_CLICK: 'LVA.ON_HOME_CLICK',
    ON_SEARCH_CLICK: 'LVA.ON_SEARCH_CLICK',
    ON_DASHBOARD_CLICK: 'LVA.ON_DASHBOARD_CLICK',
    ON_REGISTER_CLICK: 'LVA.ON_REGISTER_CLICK',
    ON_MENU_CLICK: 'LVA.ON_MENU_CLICK',
};

const LandingViewActionsMap = new Map([
    [LandingViewActionsNames.ON_LOAD, LandingViewActions.onLoad],
    [LandingViewActionsNames.ON_HOME_CLICK, LandingViewActions.onHomeClick],
    [LandingViewActionsNames.ON_SEARCH_CLICK, LandingViewActions.onSearchClick],
    [LandingViewActionsNames.ON_REGISTER_CLICK, LandingViewActions.onRegisterClick],
    [LandingViewActionsNames.ON_MENU_CLICK, LandingViewActions.onMenuClick],
    [LandingViewActionsNames.ON_DASHBOARD_CLICK, LandingViewActions.onDashboardClick],
]);

export {
    LandingViewActions,
    LandingViewActionsNames,
    LandingViewActionsMap
};
